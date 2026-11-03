package handlers

import (
	"database/sql"
	"errors"
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/maulanashalihin/laju-go/app/questops"
	"github.com/maulanashalihin/laju-go/app/services"
	"github.com/maulanashalihin/laju-go/app/session"
)

type QuestHandler struct {
	operations *questops.Store
	sessions *session.Store
	inertia *services.InertiaService
}

func NewQuestHandler(db *sql.DB,sessions *session.Store,inertia *services.InertiaService)*QuestHandler{
	return &QuestHandler{operations:&questops.Store{DB:db},sessions:sessions,inertia:inertia}
}

func (h *QuestHandler) identity(c *fiber.Ctx)(questops.Identity,error){
	uid,ok:=c.Locals("user_id").(int64)
	if !ok{return questops.Identity{},fiber.NewError(fiber.StatusUnauthorized)}
	return h.operations.Identity(c.UserContext(),uid)
}

func (h *QuestHandler) Workspace(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	data,err:=h.operations.View(c.UserContext(),actor)
	if err!=nil{return h.fail(c,err)}
	sess,err:=h.sessions.Get(c)
	if err!=nil{return h.fail(c,err)}
	return h.inertia.Render(c,"app/QuestWorkspace",fiber.Map{
		"user":sessionUser(sess),
		"quest":data,
	})
}

func (h *QuestHandler) fail(c *fiber.Ctx,err error)error{
	var rule questops.RuleError
	if errors.As(err,&rule){
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error":rule.Error()})
	}
	if fe,ok:=err.(*fiber.Error);ok{return c.Status(fe.Code).JSON(fiber.Map{"error":fe.Message})}
	slog.Error("quest operation failed","error",err,"path",c.Path())
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error":"Gagal memproses permintaan"})
}

func (h *QuestHandler) ok(c *fiber.Ctx,err error)error{
	if err!=nil{return h.fail(c,err)}
	return c.JSON(fiber.Map{"ok":true})
}

func (h *QuestHandler) CreateSidequest(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req questops.SidequestInput
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format request tidak valid"})}
	id,err:=h.operations.CreateSidequest(c.UserContext(),actor,req)
	if err!=nil{return h.fail(c,err)}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok":true,"id":id})
}

func (h *QuestHandler) CreateContent(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req questops.ContentInput
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format konten tidak valid"})}
	id,err:=h.operations.CreateContent(c.UserContext(),actor,req)
	if err!=nil{return h.fail(c,err)}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok":true,"id":id})
}

func (h *QuestHandler) AssignContent(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req questops.AssignInput
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format task tidak valid"})}
	id,err:=h.operations.AssignContentTask(c.UserContext(),actor,int64(c.ParamsInt("id")),req)
	if err!=nil{return h.fail(c,err)}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok":true,"task_id":id})
}

func (h *QuestHandler) StartTask(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	return h.ok(c,h.operations.StartTask(c.UserContext(),actor,int64(c.ParamsInt("id"))))
}

func (h *QuestHandler) SetChecklist(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req struct{Checked bool `json:"checked"`}
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format checklist tidak valid"})}
	return h.ok(c,h.operations.SetChecklist(c.UserContext(),actor,
		int64(c.ParamsInt("id")),int64(c.ParamsInt("item")),req.Checked))
}

func (h *QuestHandler) SubmitTask(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req struct {ResultURL string `json:"result_url"`}
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format hasil tidak valid"})}
	return h.ok(c,h.operations.SubmitTask(c.UserContext(),actor,int64(c.ParamsInt("id")),req.ResultURL))
}

func (h *QuestHandler) ApproveTask(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	return h.ok(c,h.operations.ApproveTask(c.UserContext(),actor,int64(c.ParamsInt("id"))))
}

func (h *QuestHandler) Revision(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req struct{Note string `json:"note"`}
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format revisi tidak valid"})}
	return h.ok(c,h.operations.ReturnTaskForRevision(c.UserContext(),actor,int64(c.ParamsInt("id")),req.Note))
}

func (h *QuestHandler) Replan(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req struct{Due string `json:"due"`; Note string `json:"note"`}
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format keputusan tidak valid"})}
	return h.ok(c,h.operations.Replan(c.UserContext(),actor,int64(c.ParamsInt("id")),req.Due,req.Note))
}

func (h *QuestHandler) RejectException(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req struct{Note string `json:"note"`}
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format alasan tidak valid"})}
	return h.ok(c,h.operations.RejectException(c.UserContext(),actor,int64(c.ParamsInt("id")),req.Note))
}

func (h *QuestHandler) SetMember(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req questops.Member
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format user tidak valid"})}
	return h.ok(c,h.operations.SetMember(c.UserContext(),actor,req))
}

func (h *QuestHandler) SetCapacity(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req questops.Member
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format kapasitas tidak valid"})}
	return h.ok(c,h.operations.SetCapacity(c.UserContext(),actor,req))
}

func (h *QuestHandler) SetPolicy(c *fiber.Ctx)error{
	actor,err:=h.identity(c)
	if err!=nil{return h.fail(c,err)}
	var req questops.Policy
	if err=c.BodyParser(&req);err!=nil{return c.Status(400).JSON(fiber.Map{"error":"Format policy tidak valid"})}
	return h.ok(c,h.operations.SetPolicy(c.UserContext(),actor,req))
}
