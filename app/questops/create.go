package questops

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type SidequestInput struct {
	Kind string `json:"kind"`
	Title string `json:"title"`
	Objective string `json:"objective"`
	Brief string `json:"brief"`
	ReferenceURL string `json:"reference_url"`
	RequestedDueAt string `json:"requested_due_at"`
}

type ContentInput struct {
	Title string `json:"title"`
	Objective string `json:"objective"`
	Brief string `json:"brief"`
	Script string `json:"script"`
	Platforms string `json:"platforms"`
	ReferenceURL string `json:"reference_url"`
}

type AssignInput struct {
	Title string `json:"title"`
	AssigneeID int64 `json:"assignee_id"`
	EffortMinutes int `json:"effort_minutes"`
	Priority int `json:"priority"`
	ChecklistText string `json:"checklist_text"`
	Due string `json:"due"`
}

func (s *Store) CreateSidequest(ctx context.Context,actor Identity,in SidequestInput) (int64,error) {
	if !validKind.MatchString(in.Kind) {return 0,RuleError("Jenis request gunakan slug huruf kecil, mis. poster")}
	title,err:=cleanRequired(in.Title,160,"Judul")
	if err!=nil{return 0,err}
	objective,err:=cleanRequired(in.Objective,600,"Tujuan")
	if err!=nil{return 0,err}
	brief,err:=cleanRequired(in.Brief,5000,"Brief")
	if err!=nil{return 0,err}
	in.ReferenceURL=strings.TrimSpace(in.ReferenceURL)
	if !validURL(in.ReferenceURL){return 0,RuleError("Referensi harus tautan HTTPS")}
	due,err:=parseDue(in.RequestedDueAt)
	if err!=nil{return 0,err}
	var id int64
	err=s.write(ctx,func(c *sql.Conn)error{
		res,e:=c.ExecContext(ctx,`INSERT INTO quest_sidequests
		(requester_id,kind,title,objective,brief,reference_url,requested_due_at)
		VALUES(?,?,?,?,?,?,?)`,actor.UserID,in.Kind,title,objective,brief,in.ReferenceURL,due.Format(time.RFC3339))
		if e!=nil{return e}
		id,e=res.LastInsertId()
		if e!=nil{return e}
		policy,e:=findPolicy(ctx,c,in.Kind)
		reason:=""
		var assignee any
		var effort any
		if errors.Is(e,sql.ErrNoRows){
			reason="Aturan effort, lead time, dan PIC belum dikonfigurasi"
		} else if e!=nil{return e}else{
			assignee=policy.AssigneeID
			effort=policy.EffortMinutes
			if due.Before(time.Now().Add(time.Duration(policy.LeadMinutes)*time.Minute)){
				reason="Melanggar minimum lead time; memerlukan keputusan Head"
			}
		}
		taskRes,e:=c.ExecContext(ctx,`INSERT INTO quest_tasks
		(source_type,source_id,title,assignee_id,priority,effort_minutes,status)
		VALUES('sidequest',?,?,?,?,?,'blocked')`,id,title,assignee,3,effort)
		if e!=nil{return e}
		taskID,e:=taskRes.LastInsertId()
		if e!=nil{return e}
		if policy.Kind!=""{
			lines,e2:=checklistLines(policy.ChecklistText)
			if e2!=nil{return e2}
			if e2=saveChecklist(ctx,c,taskID,lines);e2!=nil{return e2}
		}
		if reason=="" {
			e=s.schedule(ctx,c,taskID,policy.AssigneeID,policy.EffortMinutes,due)
			if errors.Is(e,ErrNoCapacity)||errors.Is(e,ErrNoSlot) {
				reason="Kapasitas PIC penuh atau kalender kerja belum dikonfigurasi"
			}else if e!=nil{return e}
		}
		if reason!=""{
			if e=openException(ctx,c,taskID,reason);e!=nil{return e}
			if _,e=c.ExecContext(ctx,`UPDATE quest_sidequests SET status='exception' WHERE id=?`,id);e!=nil{return e}
		}else{
			if _,e=c.ExecContext(ctx,`UPDATE quest_sidequests SET status='accepted' WHERE id=?`,id);e!=nil{return e}
		}
		return audit(ctx,c,actor.UserID,"sidequest",id,"created",in.Kind)
	})
	return id,err
}

func (s *Store) CreateContent(ctx context.Context,actor Identity,in ContentInput) (int64,error){
	if actor.Role!="head"&&actor.Role!="strategist"{return 0,RuleError("Hanya Strategist atau Head dapat membuat konten")}
	title,err:=cleanRequired(in.Title,160,"Judul")
	if err!=nil{return 0,err}
	objective,err:=cleanRequired(in.Objective,600,"Tujuan")
	if err!=nil{return 0,err}
	brief,err:=cleanRequired(in.Brief,5000,"Brief")
	if err!=nil{return 0,err}
	if len(in.Script)>10000||len(in.Platforms)>160{return 0,RuleError("Script atau platform terlalu panjang")}
	in.ReferenceURL=strings.TrimSpace(in.ReferenceURL)
	if !validURL(in.ReferenceURL){return 0,RuleError("Referensi harus tautan HTTPS")}
	var id int64
	err=s.write(ctx,func(c *sql.Conn)error{
		res,e:=c.ExecContext(ctx,`INSERT INTO quest_contents(author_id,title,objective,brief,script,platforms,reference_url)
		VALUES(?,?,?,?,?,?,?)`,actor.UserID,title,objective,brief,
		strings.TrimSpace(in.Script),strings.TrimSpace(in.Platforms),in.ReferenceURL)
		if e!=nil{return e}
		id,e=res.LastInsertId()
		if e!=nil{return e}
		return audit(ctx,c,actor.UserID,"content",id,"created","")
	})
	return id,err
}

func (s *Store) AssignContentTask(ctx context.Context,actor Identity,contentID int64,in AssignInput) (int64,error) {
	if actor.Role!="head"{return 0,RuleError("Hanya Head dapat menetapkan task produksi")}
	title,err:=cleanRequired(in.Title,160,"Task")
	if err!=nil{return 0,err}
	if in.Priority<1||in.Priority>5||in.EffortMinutes<15||in.EffortMinutes>720 {
		return 0,RuleError("Prioritas atau estimasi effort tidak valid")
	}
	due,err:=parseDue(in.Due)
	if err!=nil{return 0,err}
	checklist,err:=checklistLines(in.ChecklistText)
	if err!=nil{return 0,err}
	var taskID int64
	err=s.write(ctx,func(c *sql.Conn)error{
		var status string
		e:=c.QueryRowContext(ctx,`SELECT status FROM quest_contents WHERE id=?`,contentID).Scan(&status)
		if errors.Is(e,sql.ErrNoRows){return RuleError("Konten tidak ditemukan")}
		if e!=nil{return e}
		if status=="approved"||status=="archived"{return RuleError("Konten sudah dikunci")}
		var role string
		e=c.QueryRowContext(ctx,`SELECT role FROM quest_memberships WHERE user_id=?`,in.AssigneeID).Scan(&role)
		if errors.Is(e,sql.ErrNoRows){return RuleError("PIC belum diberi role")}
		if e!=nil{return e}
		if role!="editor"&&role!="smm"&&role!="strategist"{return RuleError("PIC bukan anggota produksi")}
		res,e:=c.ExecContext(ctx,`INSERT INTO quest_tasks
		  (source_type,source_id,title,assignee_id,priority,effort_minutes,status)
		  VALUES('content',?,?,?,?,?,'blocked')`,contentID,title,in.AssigneeID,in.Priority,in.EffortMinutes)
		if e!=nil{return e}
		taskID,e=res.LastInsertId()
		if e!=nil{return e}
		if e=saveChecklist(ctx,c,taskID,checklist);e!=nil{return e}
		reason:=""
		e=s.schedule(ctx,c,taskID,in.AssigneeID,in.EffortMinutes,due)
		if errors.Is(e,ErrNoCapacity)||errors.Is(e,ErrNoSlot){
			reason="Kapasitas atau deadline tidak memungkinkan; perlu keputusan Head"
		}else if e!=nil{return e}
		if reason!="" {if e=openException(ctx,c,taskID,reason);e!=nil{return e}}
		if _,e=c.ExecContext(ctx,`UPDATE quest_contents SET status='production' WHERE id=?`,contentID);e!=nil{return e}
		return audit(ctx,c,actor.UserID,"task",taskID,"assigned",fmt.Sprintf("content:%d",contentID))
	})
	return taskID,err
}
