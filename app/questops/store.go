package questops

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Store struct {
	DB *sql.DB
}

type Identity struct {
	UserID int64 `json:"user_id"`
	Role string `json:"role"`
	SystemAdmin bool `json:"system_admin"`
}

type Member struct {
	ID int64 `json:"id"`
	Name string `json:"name"`
	Email string `json:"email"`
	Role string `json:"role"`
	CapacityMinutes int `json:"capacity_minutes"`
	StartMinute int `json:"start_minute"`
	Workdays string `json:"workdays"`
}

type Policy struct {
	Kind string `json:"kind"`
	LeadMinutes int `json:"lead_minutes"`
	EffortMinutes int `json:"effort_minutes"`
	AssigneeID int64 `json:"assignee_id"`
	ChecklistText string `json:"checklist_text"`
}

type Content struct {
	ID int64 `json:"id"`
	Title string `json:"title"`
	Objective string `json:"objective"`
	Brief string `json:"brief"`
	Script string `json:"script"`
	Platforms string `json:"platforms"`
	ReferenceURL string `json:"reference_url"`
	Status string `json:"status"`
}

type Sidequest struct {
	ID int64 `json:"id"`
	RequesterID int64 `json:"requester_id"`
	Kind string `json:"kind"`
	Title string `json:"title"`
	Objective string `json:"objective"`
	Brief string `json:"brief"`
	ReferenceURL string `json:"reference_url"`
	RequestedDueAt string `json:"requested_due_at"`
	Status string `json:"status"`
}

type Task struct {
	ID int64 `json:"id"`
	SourceType string `json:"source_type"`
	SourceID int64 `json:"source_id"`
	Title string `json:"title"`
	AssigneeID int64 `json:"assignee_id"`
	AssigneeName string `json:"assignee_name"`
	Priority int `json:"priority"`
	EffortMinutes int `json:"effort_minutes"`
	CommittedDueAt string `json:"committed_due_at"`
	ScheduledStart string `json:"scheduled_start"`
	ScheduledEnd string `json:"scheduled_end"`
	ResultURL string `json:"result_url"`
	Objective string `json:"objective"`
	Brief string `json:"brief"`
	Script string `json:"script"`
	ReferenceURL string `json:"reference_url"`
	Checklist []ChecklistItem `json:"checklist"`
	Status string `json:"status"`
}

type ChecklistItem struct {
	ID int64 `json:"id"`
	Label string `json:"label"`
	Checked bool `json:"checked"`
}

type Exception struct {
	ID int64 `json:"id"`
	TaskID int64 `json:"task_id"`
	Reason string `json:"reason"`
	Status string `json:"status"`
	TaskTitle string `json:"task_title"`
}

type Snapshot struct {
	Identity Identity `json:"identity"`
	Tasks []Task `json:"tasks"`
	Requests []Sidequest `json:"requests"`
	Contents []Content `json:"contents"`
	Exceptions []Exception `json:"exceptions"`
	Members []Member `json:"members"`
	Policies []Policy `json:"policies"`
}

func (s *Store) Identity(ctx context.Context, userID int64) (Identity, error) {
	var sourceRole, questRole string
	err := s.DB.QueryRowContext(ctx, `
		SELECT u.role, COALESCE(m.role, 'requester')
		FROM users u LEFT JOIN quest_memberships m ON m.user_id=u.id
		WHERE u.id=?`, userID).Scan(&sourceRole, &questRole)
	return Identity{UserID: userID, Role: questRole, SystemAdmin: sourceRole == "admin"}, err
}

func CanMonitor(role string) bool {
	return role == "head" || role == "spv" || role == "owner"
}

func (s *Store) View(ctx context.Context, id Identity) (Snapshot, error) {
	out := Snapshot{
		Identity: id,
		Tasks: []Task{}, Requests: []Sidequest{}, Contents: []Content{},
		Exceptions: []Exception{}, Members: []Member{}, Policies: []Policy{},
	}
	var err error
	if id.Role != "requester" {
		out.Tasks, err = s.listTasks(ctx, id)
		if err != nil { return out, err }
	}
	out.Requests, err = s.listRequests(ctx, id)
	if err != nil { return out, err }
	if id.Role == "head" || id.Role == "strategist" || id.Role == "spv" || id.Role == "owner" {
		out.Contents, err = s.listContents(ctx)
		if err != nil { return out, err }
	}
	if CanMonitor(id.Role) {
		out.Exceptions, err = s.listExceptions(ctx)
		if err != nil { return out, err }
	}
	if CanMonitor(id.Role) || id.SystemAdmin {
		out.Members, err = s.listMembers(ctx)
		if err != nil { return out, err }
	}
	if id.Role == "head" {
		out.Policies, err = s.listPolicies(ctx)
		if err != nil { return out, err }
	}
	return out, nil
}

func (s *Store) listTasks(ctx context.Context, id Identity) ([]Task, error) {
	query := `SELECT t.id,t.source_type,t.source_id,t.title,COALESCE(t.assignee_id,0),
	  COALESCE(u.name,''),t.priority,COALESCE(t.effort_minutes,0),
	  COALESCE(t.committed_due_at,''),COALESCE(t.scheduled_start,''),
	  COALESCE(t.scheduled_end,''),t.result_url,t.status,
	  COALESCE(content.objective,request.objective,''),
	  COALESCE(content.brief,request.brief,''),
	  COALESCE(content.script,''),
	  COALESCE(content.reference_url,request.reference_url,'')
	  FROM quest_tasks t LEFT JOIN users u ON u.id=t.assignee_id
	  LEFT JOIN quest_contents content ON t.source_type='content' AND content.id=t.source_id
	  LEFT JOIN quest_sidequests request ON t.source_type='sidequest' AND request.id=t.source_id
	  WHERE 1=1`
	args := []any{}
	switch {
	case CanMonitor(id.Role):
	case id.Role == "strategist":
		query += ` AND (t.source_type='content' OR t.assignee_id=?)`
		args = append(args, id.UserID)
	default:
		query += ` AND t.assignee_id=?`
		args = append(args, id.UserID)
	}
	query += ` ORDER BY CASE t.status WHEN 'in_progress' THEN 0 WHEN 'queued' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
	          COALESCE(t.scheduled_start,'9999'),t.priority,t.id LIMIT 300`
	rows, err := s.DB.QueryContext(ctx, query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	result := []Task{}
	for rows.Next() {
		var item Task
		if err := rows.Scan(&item.ID,&item.SourceType,&item.SourceID,&item.Title,
			&item.AssigneeID,&item.AssigneeName,&item.Priority,&item.EffortMinutes,
			&item.CommittedDueAt,&item.ScheduledStart,&item.ScheduledEnd,
			&item.ResultURL,&item.Status,&item.Objective,&item.Brief,&item.Script,&item.ReferenceURL); err != nil { return nil, err }
		item.Checklist=[]ChecklistItem{}
		result = append(result,item)
	}
	if err=rows.Err();err!=nil{return nil,err}
	rows.Close()
	if len(result)==0{return result,nil}
	positions:=map[int64]int{}
	ids:=make([]any,0,len(result))
	placeholders:=make([]string,0,len(result))
	for i:=range result{
		positions[result[i].ID]=i
		ids=append(ids,result[i].ID)
		placeholders=append(placeholders,"?")
	}
	checklistQuery:=`SELECT id,task_id,label,checked FROM quest_checklist WHERE task_id IN (`+
		strings.Join(placeholders,",")+`) ORDER BY task_id,id`
	checklistRows,e:=s.DB.QueryContext(ctx,checklistQuery,ids...)
	if e!=nil{return nil,e}
	defer checklistRows.Close()
	for checklistRows.Next(){
		var item ChecklistItem
		var taskID int64
		var checked int
		if e=checklistRows.Scan(&item.ID,&taskID,&item.Label,&checked);e!=nil{return nil,e}
		item.Checked=checked==1
		result[positions[taskID]].Checklist=append(result[positions[taskID]].Checklist,item)
	}
	if e=checklistRows.Err();e!=nil{return nil,e}
	return result,nil
}

func (s *Store) listRequests(ctx context.Context, id Identity) ([]Sidequest,error) {
	query := `SELECT id,requester_id,kind,title,objective,brief,reference_url,
	  requested_due_at,status FROM quest_sidequests`
	args := []any{}
	if !CanMonitor(id.Role) {
		query += ` WHERE requester_id=?`
		args=append(args,id.UserID)
	}
	query += ` ORDER BY id DESC LIMIT 200`
	rows,err:=s.DB.QueryContext(ctx,query,args...)
	if err != nil { return nil,err }
	defer rows.Close()
	items:=[]Sidequest{}
	for rows.Next(){
		var v Sidequest
		if err:=rows.Scan(&v.ID,&v.RequesterID,&v.Kind,&v.Title,&v.Objective,
			&v.Brief,&v.ReferenceURL,&v.RequestedDueAt,&v.Status);err!=nil{return nil,err}
		items=append(items,v)
	}
	return items,rows.Err()
}

func (s *Store) listContents(ctx context.Context) ([]Content,error) {
	rows,err:=s.DB.QueryContext(ctx,`SELECT id,title,objective,brief,script,platforms,reference_url,status
	  FROM quest_contents WHERE status<>'archived' ORDER BY id DESC LIMIT 200`)
	if err!=nil{return nil,err}
	defer rows.Close()
	items:=[]Content{}
	for rows.Next(){
		var v Content
		if err:=rows.Scan(&v.ID,&v.Title,&v.Objective,&v.Brief,&v.Script,
			&v.Platforms,&v.ReferenceURL,&v.Status);err!=nil{return nil,err}
		items=append(items,v)
	}
	return items,rows.Err()
}

func (s *Store) listExceptions(ctx context.Context) ([]Exception,error) {
	rows,err:=s.DB.QueryContext(ctx,`SELECT e.id,e.task_id,e.reason,e.status,t.title
	  FROM quest_exceptions e JOIN quest_tasks t ON t.id=e.task_id
	  ORDER BY CASE e.status WHEN 'open' THEN 0 ELSE 1 END,e.id DESC LIMIT 200`)
	if err!=nil{return nil,err}
	defer rows.Close()
	items:=[]Exception{}
	for rows.Next(){
		var v Exception
		if err:=rows.Scan(&v.ID,&v.TaskID,&v.Reason,&v.Status,&v.TaskTitle);err!=nil{return nil,err}
		items=append(items,v)
	}
	return items,rows.Err()
}

func (s *Store) listMembers(ctx context.Context) ([]Member,error) {
	rows,err:=s.DB.QueryContext(ctx,`SELECT u.id,u.name,u.email,COALESCE(m.role,'requester'),
	  COALESCE(m.capacity_minutes,0),COALESCE(m.start_minute,540),COALESCE(m.workdays,'')
	  FROM users u LEFT JOIN quest_memberships m ON m.user_id=u.id ORDER BY u.id LIMIT 200`)
	if err!=nil{return nil,err}
	defer rows.Close()
	items:=[]Member{}
	for rows.Next(){
		var v Member
		if err:=rows.Scan(&v.ID,&v.Name,&v.Email,&v.Role,&v.CapacityMinutes,
			&v.StartMinute,&v.Workdays);err!=nil{return nil,err}
		items=append(items,v)
	}
	return items,rows.Err()
}

func (s *Store) listPolicies(ctx context.Context) ([]Policy,error) {
	rows,err:=s.DB.QueryContext(ctx,`SELECT kind,lead_minutes,effort_minutes,assignee_id,checklist_text
	  FROM quest_policies ORDER BY kind LIMIT 100`)
	if err!=nil{return nil,err}
	defer rows.Close()
	items:=[]Policy{}
	for rows.Next(){
		var v Policy
		if err:=rows.Scan(&v.Kind,&v.LeadMinutes,&v.EffortMinutes,&v.AssigneeID,&v.ChecklistText);err!=nil{return nil,err}
		items=append(items,v)
	}
	return items,rows.Err()
}

func (s *Store) AssertUser(ctx context.Context,userID int64) error {
	var count int
	if err:=s.DB.QueryRowContext(ctx,`SELECT COUNT(*) FROM users WHERE id=?`,userID).Scan(&count);err!=nil{
		return err
	}
	if count==0{return fmt.Errorf("user tidak ditemukan")}
	return nil
}
