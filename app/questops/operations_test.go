package questops

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/pressly/goose/v3"
	_ "github.com/mattn/go-sqlite3"
)

func setupQuest(t *testing.T) (*Store,context.Context){
	t.Helper()
	db,err:=sql.Open("sqlite3",t.TempDir()+"/quest-test.db?_foreign_keys=on")
	if err!=nil{t.Fatal(err)}
	t.Cleanup(func(){db.Close()})
	if err=goose.SetDialect("sqlite3");err!=nil{t.Fatal(err)}
	if err=goose.Up(db,"../../migrations");err!=nil{t.Fatal(err)}
	_,err=db.Exec(`INSERT INTO users(id,email,name,role) VALUES
	  (1,'admin@test.example','Admin','admin'),
	  (2,'editor@test.example','Editor','user'),
	  (3,'requester@test.example','Requester','user'),
	  (4,'other@test.example','Other','user')`)
	if err!=nil{t.Fatal(err)}
	return &Store{DB:db},context.Background()
}

func futureDue()string{
	return time.Now().In(jakarta).Add(10*24*time.Hour).Format("2006-01-02T15:04")
}

func TestSidequestPolicyAndRoleBoundaries(t *testing.T){
	store,ctx:=setupQuest(t)
	admin:=Identity{UserID:1,SystemAdmin:true,Role:"head"}
	requester:=Identity{UserID:3,Role:"requester"}
	editor:=Identity{UserID:2,Role:"editor"}

	in:=SidequestInput{
		Kind:"poster",Title:"Poster agenda",Objective:"Pengumuman internal",
		Brief:"Buat visual pengumuman dengan jam dan lokasi.",
		RequestedDueAt:futureDue(),
	}
	first,err:=store.CreateSidequest(ctx,requester,in)
	if err!=nil{t.Fatal(err)}
	var status string
	if err=store.DB.QueryRow(`SELECT status FROM quest_sidequests WHERE id=?`,first).Scan(&status);err!=nil{t.Fatal(err)}
	if status!="exception"{t.Fatalf("unconfigured request autoaccepted: %s",status)}

	if err=store.SetMember(ctx,requester,Member{ID:2,Role:"editor"});err==nil{
		t.Fatal("non-admin granted a role")
	}
	if err=store.SetMember(ctx,admin,Member{ID:1,Role:"head"});err!=nil{t.Fatal(err)}
	if err=store.SetMember(ctx,admin,Member{ID:2,Role:"editor",CapacityMinutes:480,StartMinute:540,Workdays:"1234567"});err!=nil{t.Fatal(err)}
	if err=store.SetPolicy(ctx,requester,Policy{Kind:"poster",LeadMinutes:60,EffortMinutes:60,AssigneeID:2,ChecklistText:"Review brief\nUpload hasil"});err==nil{
		t.Fatal("requester configured production policy")
	}
	if err=store.SetPolicy(ctx,admin,Policy{Kind:"poster",LeadMinutes:60,EffortMinutes:60,AssigneeID:2,ChecklistText:"Review brief\nUpload hasil"});err!=nil{t.Fatal(err)}
	second,err:=store.CreateSidequest(ctx,requester,in)
	if err!=nil{t.Fatal(err)}
	if err=store.DB.QueryRow(`SELECT status FROM quest_sidequests WHERE id=?`,second).Scan(&status);err!=nil{t.Fatal(err)}
	if status!="accepted"{t.Fatalf("valid request not scheduled: %s",status)}
	var taskID int64
	if err=store.DB.QueryRow(`SELECT id FROM quest_tasks WHERE source_type='sidequest' AND source_id=?`,second).Scan(&taskID);err!=nil{t.Fatal(err)}
	if err=store.StartTask(ctx,requester,taskID);err==nil{t.Fatal("requester started editor task")}
	if err=store.StartTask(ctx,editor,taskID);err!=nil{t.Fatal(err)}
	if err=store.SubmitTask(ctx,editor,taskID,"http://untrusted");err==nil{t.Fatal("insecure result link accepted")}
	if err=store.SubmitTask(ctx,editor,taskID,"https://drive.google.com/example");err==nil{t.Fatal("incomplete checklist accepted")}
	rows,err:=store.DB.Query(`SELECT id FROM quest_checklist WHERE task_id=?`,taskID)
	if err!=nil{t.Fatal(err)}
	var checks []int64
	for rows.Next(){var itemID int64;if err=rows.Scan(&itemID);err!=nil{t.Fatal(err)};checks=append(checks,itemID)}
	rows.Close()
	if len(checks)!=2{t.Fatalf("expected template checklist, got %d",len(checks))}
	for _,itemID:=range checks{
		if err=store.SetChecklist(ctx,requester,taskID,itemID,true);err==nil{t.Fatal("requester edited checklist")}
		if err=store.SetChecklist(ctx,editor,taskID,itemID,true);err!=nil{t.Fatal(err)}
	}
	if err=store.SubmitTask(ctx,editor,taskID,"https://drive.google.com/example");err!=nil{t.Fatal(err)}
	if err=store.ApproveTask(ctx,requester,taskID);err==nil{t.Fatal("requester approved task")}
	if err=store.ApproveTask(ctx,admin,taskID);err!=nil{t.Fatal(err)}
	if err=store.DB.QueryRow(`SELECT status FROM quest_sidequests WHERE id=?`,second).Scan(&status);err!=nil{t.Fatal(err)}
	if status!="completed"{t.Fatalf("unexpected sidequest status after final approval: %s",status)}

	visible,err:=store.View(ctx,requester)
	if err!=nil{t.Fatal(err)}
	if len(visible.Tasks)!=0||len(visible.Members)!=0||len(visible.Requests)!=2{
		t.Fatalf("requester leaked internal data: %+v",visible)
	}
	other,err:=store.View(ctx,Identity{UserID:4,Role:"requester"})
	if err!=nil{t.Fatal(err)}
	if len(other.Requests)!=0{t.Fatal("requester can read another division's request")}
}

func TestSidequestCapacityConflictDoesNotMoveExisting(t *testing.T){
	store,ctx:=setupQuest(t)
	admin:=Identity{UserID:1,Role:"head",SystemAdmin:true}
	requester:=Identity{UserID:3,Role:"requester"}
	// Restrict available days to the chosen date so one booked hour fills it.
	due:=time.Now().In(jakarta).Add(3*24*time.Hour)
	due=time.Date(due.Year(),due.Month(),due.Day(),10,0,0,0,jakarta)
	weekday:=int(due.Weekday())
	if weekday==0 {weekday=7}
	if err:=store.SetMember(ctx,admin,Member{ID:2,Role:"editor",CapacityMinutes:60,StartMinute:540,Workdays:fmt.Sprint(weekday)});err!=nil{t.Fatal(err)}
	if err:=store.SetPolicy(ctx,admin,Policy{Kind:"poster",LeadMinutes:0,EffortMinutes:60,AssigneeID:2,ChecklistText:"Review brief\nUpload hasil"});err!=nil{t.Fatal(err)}
	// Only one task can fit before the committed deadline.
	input:=SidequestInput{Kind:"poster",Title:"One",Objective:"Internal",Brief:"Make complete and clear poster",RequestedDueAt:due.Format("2006-01-02T15:04")}
	first,err:=store.CreateSidequest(ctx,requester,input)
	if err!=nil{t.Fatal(err)}
	var startBefore string
	if err=store.DB.QueryRow(`SELECT COALESCE(scheduled_start,'') FROM quest_tasks WHERE source_id=? AND source_type='sidequest'`,first).Scan(&startBefore);err!=nil{t.Fatal(err)}
	second,err:=store.CreateSidequest(ctx,requester,input)
	if err!=nil{t.Fatal(err)}
	var secondStatus string
	if err=store.DB.QueryRow(`SELECT status FROM quest_sidequests WHERE id=?`,second).Scan(&secondStatus);err!=nil{t.Fatal(err)}
	if secondStatus!="exception"{t.Fatalf("overcapacity request autoaccepted: %s",secondStatus)}
	var startAfter string
	if err=store.DB.QueryRow(`SELECT COALESCE(scheduled_start,'') FROM quest_tasks WHERE source_id=? AND source_type='sidequest'`,first).Scan(&startAfter);err!=nil{t.Fatal(err)}
	if startBefore!=startAfter{t.Fatal("existing schedule silently moved")}
}
