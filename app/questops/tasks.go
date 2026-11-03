package questops

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (s *Store) StartTask(ctx context.Context,actor Identity,taskID int64)error{
	return s.write(ctx,func(c *sql.Conn)error{
		res,err:=c.ExecContext(ctx,`UPDATE quest_tasks SET status='in_progress',
		  updated_at=datetime('now') WHERE id=? AND assignee_id=? AND status='queued'`,
		  taskID,actor.UserID)
		if err!=nil{return err}
		n,_:=res.RowsAffected()
		if n==0{return RuleError("Task belum dijadwalkan, bukan milik Anda, atau sudah dimulai")}
		return audit(ctx,c,actor.UserID,"task",taskID,"started","")
	})
}

func (s *Store) SetChecklist(ctx context.Context,actor Identity,taskID,itemID int64,checked bool)error{
	value:=0
	if checked{value=1}
	return s.write(ctx,func(c *sql.Conn)error{
		res,err:=c.ExecContext(ctx,`UPDATE quest_checklist SET checked=? WHERE id=? AND task_id=?
		  AND EXISTS (SELECT 1 FROM quest_tasks WHERE id=? AND assignee_id=?
		  AND status IN ('queued','in_progress'))`,value,itemID,taskID,taskID,actor.UserID)
		if err!=nil{return err}
		n,_:=res.RowsAffected()
		if n==0{return RuleError("Checklist bukan milik task aktif Anda")}
		return audit(ctx,c,actor.UserID,"task",taskID,"checklist",fmt.Sprintf("item:%d checked:%t",itemID,checked))
	})
}

func (s *Store) SubmitTask(ctx context.Context,actor Identity,taskID int64,resultURL string)error{
	resultURL=strings.TrimSpace(resultURL)
	if resultURL==""||!validURL(resultURL){return RuleError("Hasil kerja wajib berupa tautan HTTPS")}
	return s.write(ctx,func(c *sql.Conn)error{
		var remaining int
		if err:=c.QueryRowContext(ctx,`SELECT COUNT(*) FROM quest_checklist WHERE task_id=? AND checked=0`,taskID).Scan(&remaining);err!=nil{return err}
		if remaining>0{return RuleError("Semua checklist harus selesai sebelum submit")}
		res,err:=c.ExecContext(ctx,`UPDATE quest_tasks SET status='review',result_url=?,
		  updated_at=datetime('now') WHERE id=? AND assignee_id=?
		  AND status IN ('queued','in_progress')`,resultURL,taskID,actor.UserID)
		if err!=nil{return err}
		n,_:=res.RowsAffected()
		if n==0{return RuleError("Task tidak dapat dikirim untuk review")}
		return audit(ctx,c,actor.UserID,"task",taskID,"submitted","")
	})
}

func (s *Store) ApproveTask(ctx context.Context,actor Identity,taskID int64)error{
	if actor.Role!="head"{return RuleError("Hanya Head dapat memberi final approval")}
	return s.write(ctx,func(c *sql.Conn)error{
		var source string
		var sourceID int64
		err:=c.QueryRowContext(ctx,`SELECT source_type,source_id FROM quest_tasks
		  WHERE id=? AND status='review'`,taskID).Scan(&source,&sourceID)
		if errors.Is(err,sql.ErrNoRows){return RuleError("Task bukan dalam tahap review")}
		if err!=nil{return err}
		if _,err=c.ExecContext(ctx,`UPDATE quest_tasks SET status='done',
		  updated_at=datetime('now') WHERE id=?`,taskID);err!=nil{return err}
		var active int
		if err=c.QueryRowContext(ctx,`SELECT COUNT(*) FROM quest_tasks
		  WHERE source_type=? AND source_id=? AND status NOT IN ('done','cancelled')`,
		  source,sourceID).Scan(&active);err!=nil{return err}
		if active==0{
			if source=="content"{
				_,err=c.ExecContext(ctx,`UPDATE quest_contents SET status='approved' WHERE id=?`,sourceID)
			}else{
				_,err=c.ExecContext(ctx,`UPDATE quest_sidequests SET status='completed' WHERE id=?`,sourceID)
			}
			if err!=nil{return err}
		}
		return audit(ctx,c,actor.UserID,"task",taskID,"approved","")
	})
}

func (s *Store) ReturnTaskForRevision(ctx context.Context,actor Identity,taskID int64,note string)error{
	if actor.Role!="head"{return RuleError("Hanya Head dapat meminta revisi")}
	note,err:=cleanRequired(note,1000,"Catatan revisi")
	if err!=nil{return err}
	return s.write(ctx,func(c *sql.Conn)error{
		res,e:=c.ExecContext(ctx,`UPDATE quest_tasks SET status='in_progress',
		  updated_at=datetime('now') WHERE id=? AND status='review'`,taskID)
		if e!=nil{return e}
		n,_:=res.RowsAffected()
		if n==0{return RuleError("Task bukan dalam tahap review")}
		return audit(ctx,c,actor.UserID,"task",taskID,"revision",note)
	})
}

// Replan only touches the blocked task. Existing commitments are never shifted.
// Head's explicit decision can waive lead-time restrictions, but not double-book slots.
func (s *Store) Replan(ctx context.Context,actor Identity,exceptionID int64,dueInput,note string)error{
	if actor.Role!="head"{return RuleError("Hanya Head dapat memutuskan exception")}
	note,err:=cleanRequired(note,1000,"Alasan keputusan")
	if err!=nil{return err}
	due,err:=parseDue(dueInput)
	if err!=nil{return err}
	return s.write(ctx,func(c *sql.Conn)error{
		var taskID,sourceID,assigneeID int64
		var source string
		var effort int
		err:=c.QueryRowContext(ctx,`SELECT t.id,t.source_type,t.source_id,
		  COALESCE(t.assignee_id,0),COALESCE(t.effort_minutes,0)
		  FROM quest_exceptions e JOIN quest_tasks t ON t.id=e.task_id
		  WHERE e.id=? AND e.status='open' AND t.status='blocked'`,exceptionID).
		  Scan(&taskID,&source,&sourceID,&assigneeID,&effort)
		if errors.Is(err,sql.ErrNoRows){return RuleError("Exception tidak ditemukan atau sudah diputuskan")}
		if err!=nil{return err}
		if source=="sidequest" && (assigneeID==0||effort==0) {
			var kind string
			if err=c.QueryRowContext(ctx,`SELECT kind FROM quest_sidequests WHERE id=?`,sourceID).Scan(&kind);err!=nil{return err}
			p,e:=findPolicy(ctx,c,kind)
			if errors.Is(e,sql.ErrNoRows){return RuleError("Aturan jenis request harus dikonfigurasi lebih dulu")}
			if e!=nil{return e}
			assigneeID=p.AssigneeID
			effort=p.EffortMinutes
		}
		err=s.schedule(ctx,c,taskID,assigneeID,effort,due)
		if errors.Is(err,ErrNoCapacity)||errors.Is(err,ErrNoSlot){
			return RuleError("Tidak ada slot aman; perpanjang deadline atau konfigurasi kapasitas PIC")
		}
		if err!=nil{return err}
		if _,err=c.ExecContext(ctx,`UPDATE quest_exceptions SET status='resolved',
		  decided_by=?,decision_note=?,decided_at=datetime('now') WHERE id=?`,
		  actor.UserID,note,exceptionID);err!=nil{return err}
		if source=="sidequest"{
			if _,err=c.ExecContext(ctx,`UPDATE quest_sidequests SET status='accepted'
			  WHERE id=?`,sourceID);err!=nil{return err}
		}
		return audit(ctx,c,actor.UserID,"exception",exceptionID,"resolved",note)
	})
}

func (s *Store) RejectException(ctx context.Context,actor Identity,exceptionID int64,note string)error{
	if actor.Role!="head"{return RuleError("Hanya Head dapat menolak exception")}
	note,err:=cleanRequired(note,1000,"Alasan penolakan")
	if err!=nil{return err}
	return s.write(ctx,func(c *sql.Conn)error{
		var taskID,sourceID int64
		var source string
		err:=c.QueryRowContext(ctx,`SELECT t.id,t.source_type,t.source_id
		  FROM quest_exceptions e JOIN quest_tasks t ON t.id=e.task_id
		  WHERE e.id=? AND e.status='open' AND t.status='blocked'`,exceptionID).
		  Scan(&taskID,&source,&sourceID)
		if errors.Is(err,sql.ErrNoRows){return RuleError("Exception tidak ditemukan")}
		if err!=nil{return err}
		if _,err=c.ExecContext(ctx,`UPDATE quest_tasks SET status='cancelled',
		  updated_at=datetime('now') WHERE id=?`,taskID);err!=nil{return err}
		if _,err=c.ExecContext(ctx,`UPDATE quest_exceptions SET status='rejected',
		  decided_by=?,decision_note=?,decided_at=datetime('now') WHERE id=?`,
		  actor.UserID,note,exceptionID);err!=nil{return err}
		if source=="sidequest"{
			if _,err=c.ExecContext(ctx,`UPDATE quest_sidequests SET status='rejected'
			  WHERE id=?`,sourceID);err!=nil{return err}
		}
		return audit(ctx,c,actor.UserID,"exception",exceptionID,"rejected",note)
	})
}

func (s *Store) CheckTaskOwnership(ctx context.Context,actor Identity,taskID int64)error {
	var owner int64
	if err:=s.DB.QueryRowContext(ctx,`SELECT COALESCE(assignee_id,0)
	  FROM quest_tasks WHERE id=?`,taskID).Scan(&owner);err!=nil{return err}
	if owner!=actor.UserID{return fmt.Errorf("forbidden")}
	return nil
}

func dateValue(t time.Time) string {return t.UTC().Format(time.RFC3339)}
