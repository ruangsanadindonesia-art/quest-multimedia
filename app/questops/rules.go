package questops

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type RuleError string
func (e RuleError) Error() string { return string(e) }

var validKind = regexp.MustCompile(`^[a-z][a-z0-9_-]{1,39}$`)
var jakarta = time.FixedZone("WIB", 7*3600)

func cleanRequired(s string, max int, label string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" || len(s) > max { return "", RuleError(label + " wajib diisi (maksimal sesuai aturan)") }
	return s,nil
}

func parseDue(value string) (time.Time,error) {
	due,err:=time.ParseInLocation("2006-01-02T15:04",value,jakarta)
	if err!=nil || !due.After(time.Now()) || due.After(time.Now().AddDate(1,0,0)) {
		return time.Time{},RuleError("Deadline harus tanggal dan jam WIB di masa depan (maksimal 1 tahun)")
	}
	return due.UTC(),nil
}

func validURL(raw string) bool {
	if raw=="" {return true}
	if len(raw)>2048 {return false}
	u,err:=url.Parse(raw)
	return err==nil && u.Scheme=="https" && u.Host!=""
}

func (s *Store) write(ctx context.Context, f func(*sql.Conn) error) error {
	conn,err:=s.DB.Conn(ctx)
	if err!=nil {return err}
	defer conn.Close()
	if _,err=conn.ExecContext(ctx,"BEGIN IMMEDIATE");err!=nil{return err}
	defer conn.ExecContext(context.Background(),"ROLLBACK")
	if err=f(conn);err!=nil{return err}
	_,err=conn.ExecContext(ctx,"COMMIT")
	return err
}

func audit(ctx context.Context,c *sql.Conn,actor int64,entity string,id int64,action,note string) error {
	_,err:=c.ExecContext(ctx,`INSERT INTO quest_activity(actor_id,entity_type,entity_id,action,note)
	  VALUES(?,?,?,?,?)`,actor,entity,id,action,note)
	return err
}

func (s *Store) SetMember(ctx context.Context,actor Identity,member Member) error {
	if !actor.SystemAdmin {return RuleError("Hanya administrator sistem dapat menetapkan role")}
	switch member.Role {
	case "head","strategist","smm","editor","requester","spv","owner":
	default: return RuleError("Role tidak tersedia")
	}
	if member.CapacityMinutes<0 || member.CapacityMinutes>720 ||
		member.StartMinute<0 || member.StartMinute>1439 ||
		member.StartMinute+member.CapacityMinutes>1440 {
		return RuleError("Jam kapasitas tidak valid")
	}
	for _,d:=range member.Workdays {
		if d<'1'||d>'7' {return RuleError("Workdays harus menggunakan digit ISO 1 sampai 7")}
	}
	return s.write(ctx,func(c *sql.Conn) error {
		var count int
		if err:=c.QueryRowContext(ctx,`SELECT COUNT(*) FROM users WHERE id=?`,member.ID).Scan(&count);err!=nil{return err}
		if count==0{return RuleError("User tidak ditemukan")}
		_,err:=c.ExecContext(ctx,`INSERT INTO quest_memberships(user_id,role,capacity_minutes,start_minute,workdays)
		  VALUES(?,?,?,?,?)
		  ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,capacity_minutes=excluded.capacity_minutes,
		  start_minute=excluded.start_minute,workdays=excluded.workdays,updated_at=datetime('now')`,
		  member.ID,member.Role,member.CapacityMinutes,member.StartMinute,member.Workdays)
		if err!=nil{return err}
		return audit(ctx,c,actor.UserID,"member",member.ID,"configure",member.Role)
	})
}

func (s *Store) SetCapacity(ctx context.Context,actor Identity,member Member) error {
	if actor.Role!="head" && !actor.SystemAdmin{return RuleError("Hanya Head dapat mengatur kapasitas")}
	if member.CapacityMinutes<0 || member.CapacityMinutes>720 || member.StartMinute<0 ||
		member.StartMinute+member.CapacityMinutes>1440 {return RuleError("Kapasitas tidak valid")}
	for _,d:=range member.Workdays {if d<'1'||d>'7'{return RuleError("Workdays tidak valid")}}
	return s.write(ctx,func(c *sql.Conn) error {
		res,err:=c.ExecContext(ctx,`UPDATE quest_memberships SET capacity_minutes=?,start_minute=?,
		workdays=?,updated_at=datetime('now') WHERE user_id=? AND role IN ('editor','smm','strategist')`,
		  member.CapacityMinutes,member.StartMinute,member.Workdays,member.ID)
		if err!=nil{return err}
		n,_:=res.RowsAffected()
		if n==0{return RuleError("PIC belum memiliki role produksi")}
		return audit(ctx,c,actor.UserID,"member",member.ID,"capacity",fmt.Sprintf("%d menit",member.CapacityMinutes))
	})
}

func checklistLines(text string)([]string,error){
	parts:=strings.Split(strings.ReplaceAll(text,"\r",""),"\n")
	items:=[]string{}
	for _,line:=range parts{
		line=strings.TrimSpace(line)
		if line==""{continue}
		if len(line)>160{return nil,RuleError("Setiap checklist maksimal 160 karakter")}
		items=append(items,line)
	}
	if len(items)==0||len(items)>20{return nil,RuleError("Checklist wajib memiliki 1 sampai 20 poin")}
	return items,nil
}

func saveChecklist(ctx context.Context,c *sql.Conn,taskID int64,lines []string)error{
	for _,line:=range lines{
		if _,err:=c.ExecContext(ctx,`INSERT INTO quest_checklist(task_id,label) VALUES(?,?)`,taskID,line);err!=nil{return err}
	}
	return nil
}

func (s *Store) SetPolicy(ctx context.Context,actor Identity,p Policy) error {
	if actor.Role!="head"{return RuleError("Hanya Head dapat menetapkan SLA")}
	if !validKind.MatchString(p.Kind)||p.LeadMinutes<0||p.LeadMinutes>60*24*90||
		p.EffortMinutes<15||p.EffortMinutes>720 {return RuleError("Jenis, lead time, atau effort tidak valid")}
	if _,err:=checklistLines(p.ChecklistText);err!=nil{return err}
	return s.write(ctx,func(c *sql.Conn)error{
		var role string
		err:=c.QueryRowContext(ctx,`SELECT role FROM quest_memberships WHERE user_id=?`,p.AssigneeID).Scan(&role)
		if errors.Is(err,sql.ErrNoRows) {return RuleError("PIC harus punya role produksi")}
		if err!=nil{return err}
		if role!="editor"&&role!="smm"&&role!="strategist"{return RuleError("PIC tidak punya role produksi")}
		_,err=c.ExecContext(ctx,`INSERT INTO quest_policies(kind,lead_minutes,effort_minutes,assignee_id,checklist_text)
		VALUES(?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET lead_minutes=excluded.lead_minutes,
		effort_minutes=excluded.effort_minutes,assignee_id=excluded.assignee_id,
		checklist_text=excluded.checklist_text,updated_at=datetime('now')`,
		  p.Kind,p.LeadMinutes,p.EffortMinutes,p.AssigneeID,p.ChecklistText)
		if err!=nil{return err}
		return audit(ctx,c,actor.UserID,"policy",p.AssigneeID,"configure",p.Kind)
	})
}

func findPolicy(ctx context.Context,c *sql.Conn,kind string) (Policy,error) {
	var p Policy
	err:=c.QueryRowContext(ctx,`SELECT kind,lead_minutes,effort_minutes,assignee_id,checklist_text
	  FROM quest_policies WHERE kind=?`,kind).Scan(&p.Kind,&p.LeadMinutes,&p.EffortMinutes,&p.AssigneeID,&p.ChecklistText)
	return p,err
}

func (s *Store) schedule(ctx context.Context,c *sql.Conn,taskID,assigneeID int64,
	effort int,due time.Time) error {
	var cap Capacity
	err:=c.QueryRowContext(ctx,`SELECT capacity_minutes,start_minute,workdays
	  FROM quest_memberships WHERE user_id=? AND role IN ('editor','smm','strategist')`,assigneeID).
	  Scan(&cap.DailyMinutes,&cap.StartMinute,&cap.Workdays)
	if errors.Is(err,sql.ErrNoRows){return ErrNoCapacity}
	if err!=nil{return err}
	rows,err:=c.QueryContext(ctx,`SELECT scheduled_start,scheduled_end FROM quest_tasks
	  WHERE assignee_id=? AND scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL
	  AND id<>? AND status<>'cancelled' ORDER BY scheduled_start`,assigneeID,taskID)
	if err!=nil{return err}
	occupied:=[]Slot{}
	for rows.Next(){
		var start,end string
		if err=rows.Scan(&start,&end);err!=nil{break}
		a,e1:=time.Parse(time.RFC3339,start)
		b,e2:=time.Parse(time.RFC3339,end)
		if e1!=nil||e2!=nil{err=fmt.Errorf("invalid existing allocation");break}
		occupied=append(occupied,Slot{Start:a,End:b})
	}
	if e:=rows.Err();err==nil {err=e}
	rows.Close()
	if err!=nil{return err}
	slot,err:=Plan(time.Now().UTC(),due,effort,cap,occupied,jakarta)
	if err!=nil{return err}
	_,err=c.ExecContext(ctx,`UPDATE quest_tasks SET assignee_id=?,effort_minutes=?,
	  committed_due_at=?,scheduled_start=?,scheduled_end=?,status='queued',updated_at=datetime('now')
	  WHERE id=? AND status='blocked'`,
	  assigneeID,effort,due.UTC().Format(time.RFC3339),
	  slot.Start.UTC().Format(time.RFC3339),slot.End.UTC().Format(time.RFC3339),taskID)
	return err
}

func openException(ctx context.Context,c *sql.Conn,taskID int64,reason string) error {
	_,err:=c.ExecContext(ctx,`INSERT INTO quest_exceptions(task_id,reason,status)
	VALUES(?,?,'open') ON CONFLICT(task_id) DO UPDATE SET reason=excluded.reason,status='open',
	decided_by=NULL,decision_note=NULL,decided_at=NULL`,taskID,reason)
	return err
}
