import { useMemo, useState } from "react";
import { LogOut, LayoutDashboard, ListTodo, CalendarDays, Inbox, ShieldAlert, Users, Settings2, CheckCircle2, Clock3, Plus, ExternalLink, Layers3 } from "lucide-react";
import { router } from "@inertiajs/react";
import type { User } from "@lib/types";
import { getCSRFToken } from "@lib/utils/csrf";

type Identity = { user_id: number; role: string; system_admin: boolean };
type Checklist = { id: number; label: string; checked: boolean };
type Task = { id: number; source_type: string; source_id: number; title: string; assignee_id: number; assignee_name: string; priority: number; effort_minutes: number; committed_due_at: string; scheduled_start: string; scheduled_end: string; result_url: string; objective: string; brief: string; script: string; reference_url: string; checklist: Checklist[]; status: string };
type Sidequest = { id: number; requester_id: number; kind: string; title: string; objective: string; brief: string; reference_url: string; requested_due_at: string; status: string };
type Content = { id: number; title: string; objective: string; brief: string; script: string; platforms: string; reference_url: string; status: string };
type Exception = { id: number; task_id: number; reason: string; status: string; task_title: string };
type Member = { id: number; name: string; email: string; role: string; capacity_minutes: number; start_minute: number; workdays: string };
type Policy = { kind: string; lead_minutes: number; effort_minutes: number; assignee_id: number; checklist_text: string };
type Quest = { identity: Identity; tasks: Task[]; requests: Sidequest[]; contents: Content[]; exceptions: Exception[]; members: Member[]; policies: Policy[] };
type Props = { user: User; quest: Quest };

const roleNames: Record<string, string> = { head: "Head Multimedia", strategist: "Content Strategist", smm: "Social Media Manager", editor: "Editor / Designer", requester: "Requester", spv: "Supervisor", owner: "Owner" };
const statuses: Record<string, string> = { queued: "Terjadwal", in_progress: "Dikerjakan", review: "Menunggu review", done: "Selesai", blocked: "Tertahan", cancelled: "Dibatalkan", pending: "Menunggu", accepted: "Diterima", exception: "Pengecualian", rejected: "Ditolak", completed: "Selesai", draft: "Draft", production: "Produksi", approved: "Disetujui", open: "Perlu keputusan", resolved: "Diselesaikan" };
function dateWIB(value: string) {
    if (!value) return "Belum dikomit";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(d) + " WIB";
}
function Tag({ label, warn = false }: { label: string; warn?: boolean }) {
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${warn ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{statuses[label] || label}</span>;
}
function Block({ children, title, detail }: { children: React.ReactNode; title: string; detail?: string }) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5"><h2 className="text-lg font-semibold text-slate-950">{title}</h2>{detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}</div>{children}
    </section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>;
}
const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15";
const btn = "inline-flex items-center justify-center rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn = "inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function TaskCard({ task, own, isHead, send, busy }: { task: Task; own: boolean; isHead: boolean; send: (path: string, body?: object) => Promise<void>; busy: boolean }) {
    const [link, setLink] = useState(task.result_url || "");
    const [note, setNote] = useState("");
    return <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-medium uppercase tracking-wider text-teal-700">{task.source_type === "content" ? "Content Calendar" : "Sidequest"} · #{task.source_id}</p><h3 className="mt-1 font-semibold text-slate-900">{task.title}</h3></div><Tag label={task.status} warn={task.status === "blocked" || task.status === "review"} /></div>
        <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2"><p>PIC: {task.assignee_name || "Belum ditentukan"}</p><p>Effort: {task.effort_minutes ? task.effort_minutes + " menit" : "Belum dikonfigurasi"}</p><p>Slot: {dateWIB(task.scheduled_start)}</p><p>Deadline disepakati: {dateWIB(task.committed_due_at)}</p></div>
        <details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><summary className="cursor-pointer font-semibold text-teal-900">Creative brief dan aset</summary><p className="mt-2 font-medium">{task.objective}</p><p className="mt-2 whitespace-pre-wrap">{task.brief}</p>{task.script && <p className="mt-2 whitespace-pre-wrap">Script: {task.script}</p>}{task.reference_url && <a className="mt-2 inline-flex items-center gap-1 text-teal-800 underline" href={task.reference_url} target="_blank" rel="noreferrer">Buka referensi <ExternalLink size={13}/></a>}</details>
        <div className="mt-3 space-y-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Checklist produksi</p>{task.checklist?.length ? task.checklist.map(item=><label key={item.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-sm"><input type="checkbox" className="accent-teal-800" checked={item.checked} disabled={!own || busy || !["queued","in_progress"].includes(task.status)} onChange={e=>void send(`/app/quest/tasks/${task.id}/checklist/${item.id}`,{checked:e.target.checked})}/><span className={item.checked ? "text-slate-500 line-through" : "text-slate-700"}>{item.label}</span></label>) : <p className="text-xs text-slate-400">Belum ada checklist.</p>}</div>
        {task.result_url && <a href={task.result_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-800 underline">Lihat hasil <ExternalLink size={14} /></a>}
        {own && (task.status === "queued" || task.status === "in_progress") && <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            {task.status === "queued" && <button disabled={busy} onClick={() => void send(`/app/quest/tasks/${task.id}/start`)} className={secondaryBtn}>Mulai pekerjaan</button>}
            <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Link hasil Google Drive" className={input} value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/..." /><button disabled={busy || !link.trim()} className={btn} onClick={() => void send(`/app/quest/tasks/${task.id}/submit`, { result_url: link })}>Kirim review</button></div>
        </div>}
        {isHead && task.status === "review" && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            <button disabled={busy} onClick={() => void send(`/app/quest/tasks/${task.id}/approve`)} className={btn}>Final approval</button>
            <div className="flex flex-col gap-2 sm:flex-row"><input className={input} aria-label="Alasan revisi" placeholder="Catatan revisi wajib" value={note} onChange={e => setNote(e.target.value)} /><button disabled={busy || !note.trim()} className={secondaryBtn} onClick={() => void send(`/app/quest/tasks/${task.id}/revision`, { note })}>Minta revisi</button></div>
        </div>}
    </article>;
}

function ExceptionCard({ item, canDecide, send, busy }: { item: Exception; canDecide: boolean; send: (path: string, body?: object) => Promise<void>; busy: boolean }) {
    const [due, setDue] = useState("");
    const [note, setNote] = useState("");
    return <article className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{item.task_title}</h3><Tag label={item.status} warn /></div>
        <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
        {canDecide && item.status === "open" && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr]">
            <Field label="Deadline alternatif WIB"><input className={input} type="datetime-local" value={due} onChange={e => setDue(e.target.value)} /></Field>
            <Field label="Alasan keputusan"><input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Wajib, tercatat di audit log" /></Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={btn} disabled={busy || !due || !note.trim()} onClick={() => void send(`/app/quest/exceptions/${item.id}/replan`, { due, note })}>Coba jadwalkan</button><button className={secondaryBtn} disabled={busy || !note.trim()} onClick={() => void send(`/app/quest/exceptions/${item.id}/reject`, { note })}>Tolak dengan alasan</button></div>
        </div>}
    </article>;
}

export default function QuestWorkspace({ user, quest }: Props) {
    const { identity } = quest;
    const role = identity.role;
    const head = role === "head";
    const monitor = head || role === "spv" || role === "owner";
    const planner = head || role === "strategist";
    const [active, setActive] = useState(head || monitor ? "overview" : role === "requester" ? "sidequest" : "myquest");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [sidequest, setSidequest] = useState({ kind: "", title: "", objective: "", brief: "", reference_url: "", requested_due_at: "" });
    const [content, setContent] = useState({ title: "", objective: "", brief: "", script: "", platforms: "", reference_url: "" });
    const [assignment, setAssignment] = useState({ contentID: "", title: "", assignee_id: "", effort_minutes: "", checklist_text: "", priority: "3", due: "" });
    const [policy, setPolicy] = useState({ kind: "", lead_minutes: "", effort_minutes: "", assignee_id: "", checklist_text: "" });
    const [memberID, setMemberID] = useState("");
    const [memberRole, setMemberRole] = useState("requester");
    const [capacity, setCapacity] = useState({ memberID: "", capacity_minutes: "", start_minute: "540", workdays: "" });

    const canViewTasks = role !== "requester";
    const menus = [
        { id: "overview", name: "Control Tower", icon: LayoutDashboard, show: monitor },
        { id: "myquest", name: "My Quest", icon: ListTodo, show: canViewTasks },
        { id: "content", name: "Content Operations", icon: CalendarDays, show: planner || monitor },
        { id: "sidequest", name: "Sidequest", icon: Inbox, show: true },
        { id: "exceptions", name: "Exception Inbox", icon: ShieldAlert, show: monitor },
        { id: "policies", name: "SLA & Kapasitas", icon: Settings2, show: head },
        { id: "team", name: "Role & Akses", icon: Users, show: identity.system_admin },
    ].filter(m => m.show);

    async function send(path: string, body: object = {}) {
        setBusy(true); setError(""); setNotice("");
        try {
            const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Accept": "application/json", "X-XSRF-TOKEN": getCSRFToken() }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Permintaan gagal");
            setNotice("Perubahan tersimpan.");
            router.reload({ only: ["quest"] });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Gagal memproses permintaan");
        } finally { setBusy(false); }
    }

    const ownTasks = useMemo(() => quest.tasks.filter(t => t.assignee_id === user.id), [quest.tasks, user.id]);
    const pending = quest.tasks.filter(t => t.status !== "done" && t.status !== "cancelled").length;
    const atRisk = quest.tasks.filter(t => t.committed_due_at && t.status !== "done" && t.status !== "cancelled" && new Date(t.committed_due_at).getTime() < Date.now() + 48 * 60 * 60 * 1000).length;
    const openExceptions = quest.exceptions.filter(e => e.status === "open").length;
    const staff = quest.members.filter(m => ["editor", "smm", "strategist"].includes(m.role));
    const selectedMember = quest.members.find(m => String(m.id) === memberID);

    return <div className="min-h-screen bg-[#F7F8F8] text-slate-900">
        <div className="mx-auto flex max-w-[1600px] flex-col md:min-h-screen md:flex-row">
            <aside className="w-full shrink-0 bg-[#102B35] px-5 py-6 text-white md:min-h-screen md:w-64">
                <div className="mb-8 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/35 bg-amber-300/10 text-amber-200"><Layers3 size={23}/></div><div><p className="text-sm font-bold tracking-wide">QUEST</p><p className="text-xs tracking-[0.2em] text-amber-200/80">MULTIMEDIA</p></div></div>
                <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
                <nav aria-label="Menu Quest Multimedia" className="flex gap-1 overflow-x-auto pb-1 md:flex-col">{menus.map(item => <button key={item.id} onClick={() => setActive(item.id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition md:w-full ${active === item.id ? "bg-white/15 font-semibold text-white" : "text-slate-300 hover:bg-white/10"}`}><item.icon size={17}/>{item.name}</button>)}</nav>
                <div className="mt-8 border-t border-white/10 pt-5"><p className="truncate text-sm font-semibold">{user.name}</p><p className="mt-1 text-xs text-slate-400">{roleNames[role] || role}</p><div className="mt-4 flex gap-4"><a href="/app/profile" className="text-xs text-amber-200 hover:underline">Profil</a><button onClick={() => router.post("/logout")} className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"><LogOut size={13}/> Keluar</button></div></div>
            </aside>
            <main className="min-w-0 flex-1 px-4 py-7 md:px-8 md:py-10">
                <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700">Ruang Sanad · Production Operations</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{menus.find(m => m.id === active)?.name || "Quest Multimedia"}</h1><p className="mt-2 text-sm text-slate-500">Semua pekerjaan, PIC, dan keputusan produksi pada satu sistem.</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600"><p>Role aktif</p><p className="mt-1 font-semibold text-slate-900">{roleNames[role] || role}</p></div></div>
                {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
                {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
                {active === "overview" && monitor && <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {[{ label: "Task aktif yang terlihat", value: pending, icon: ListTodo }, { label: "Deadline dalam 48 jam / terlewat", value: atRisk, icon: Clock3 }, { label: "Exception terbuka", value: openExceptions, icon: ShieldAlert }].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><item.icon size={18} className="text-teal-700"/><p className="mt-4 text-3xl font-semibold">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></div>)}
                    </div>
                    <Block title="Pekerjaan prioritas" detail="Daftar yang terlihat sesuai permission. Bukan angka KPI historis."><div className="space-y-3">{quest.tasks.filter(t => ["queued","in_progress","blocked","review"].includes(t.status)).slice(0,8).map(t => <TaskCard key={t.id} task={t} own={t.assignee_id === user.id} isHead={head} send={send} busy={busy} />)}{quest.tasks.length === 0 && <p className="text-sm text-slate-500">Belum ada task yang terdaftar.</p>}</div></Block>
                </div>}
                {active === "myquest" && canViewTasks && <Block title="Antrean produksi terpadu" detail="Task dari kalender konten dan Sidequest, diurutkan berdasarkan status dan slot kerja. PIC hanya boleh mengeksekusi task miliknya.">
                    <div className="mb-4 flex flex-wrap gap-2"><Tag label="queued"/><Tag label="in_progress"/><Tag label="blocked" warn/><Tag label="review" warn/></div>
                    <div className="space-y-3">{(monitor ? quest.tasks : ownTasks).map(t => <TaskCard key={t.id} task={t} own={t.assignee_id === user.id} isHead={head} send={send} busy={busy}/>)}{quest.tasks.length === 0 && <p className="text-sm text-slate-500">Antrean kosong. Pekerjaan baru muncul setelah brief dan jadwal tervalidasi.</p>}</div>
                </Block>}
                {active === "content" && (planner || monitor) && <div className="space-y-5">
                    {planner && <Block title="Buat Content Item" detail="Strategist menyiapkan brief; Head menetapkan tugas produksi.">
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => {e.preventDefault();void send("/app/quest/contents",content);}}>
                            <Field label="Judul konten"><input required maxLength={160} className={input} value={content.title} onChange={e => setContent({...content,title:e.target.value})}/></Field>
                            <Field label="Platform target"><input className={input} value={content.platforms} onChange={e => setContent({...content,platforms:e.target.value})} placeholder="Instagram, TikTok, Shorts"/></Field>
                            <Field label="Tujuan"><input required className={input} value={content.objective} onChange={e => setContent({...content,objective:e.target.value})}/></Field>
                            <Field label="Script"><input className={input} value={content.script} onChange={e => setContent({...content,script:e.target.value})}/></Field>
                            <Field label="Aset / referensi"><input className={input} type="url" placeholder="https://drive.google.com/..." value={content.reference_url} onChange={e => setContent({...content,reference_url:e.target.value})}/></Field>
                            <div className="sm:col-span-2"><Field label="Creative brief"><textarea required rows={3} maxLength={5000} className={input} value={content.brief} onChange={e => setContent({...content,brief:e.target.value})}/></Field></div>
                            <div className="sm:col-span-2"><button disabled={busy} className={btn}><Plus size={16} className="mr-2"/> Simpan content item</button></div>
                        </form>
                    </Block>}
                    {head && <Block title="Tugaskan produksi" detail="Task baru memakai slot aman, atau menjadi exception bila kapasitas tidak cukup.">
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void send(`/app/quest/contents/${assignment.contentID}/tasks`,{title:assignment.title,assignee_id:Number(assignment.assignee_id),effort_minutes:Number(assignment.effort_minutes),priority:Number(assignment.priority),checklist_text:assignment.checklist_text,due:assignment.due});}}>
                            <Field label="Konten"><select required className={input} value={assignment.contentID} onChange={e=>setAssignment({...assignment,contentID:e.target.value})}><option value="">Pilih konten</option>{quest.contents.filter(c=>c.status!=="approved").map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
                            <Field label="Task"><input required className={input} value={assignment.title} onChange={e=>setAssignment({...assignment,title:e.target.value})} placeholder="Mis. Desain 6 slide"/></Field>
                            <Field label="PIC"><select required className={input} value={assignment.assignee_id} onChange={e=>setAssignment({...assignment,assignee_id:e.target.value})}><option value="">Pilih PIC</option>{staff.map(m=><option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}</select></Field>
                            <Field label="Deadline WIB"><input required className={input} type="datetime-local" value={assignment.due} onChange={e=>setAssignment({...assignment,due:e.target.value})}/></Field>
                            <Field label="Estimasi (menit)"><input required min={15} max={720} type="number" className={input} value={assignment.effort_minutes} onChange={e=>setAssignment({...assignment,effort_minutes:e.target.value})}/></Field>
                            <Field label="Prioritas (1 tertinggi)"><select className={input} value={assignment.priority} onChange={e=>setAssignment({...assignment,priority:e.target.value})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></Field>
                            <div className="sm:col-span-2"><Field label="Checklist produksi (satu poin per baris)"><textarea required rows={3} className={input} value={assignment.checklist_text} onChange={e=>setAssignment({...assignment,checklist_text:e.target.value})} placeholder={"Periksa materi\nBuat desain\nUnggah hasil"}/></Field></div>
                            <div className="sm:col-span-2"><button disabled={busy} className={btn}>Buat task & periksa jadwal</button></div>
                        </form>
                    </Block>}
                    <Block title="Daftar konten" detail="Satu konten dapat mempunyai beberapa task dengan PIC berbeda.">
                        <div className="space-y-3">{quest.contents.map(c=><article key={c.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs text-slate-400">Content #{c.id} · {c.platforms || "Platform belum dipilih"}</p><h3 className="mt-1 font-semibold">{c.title}</h3></div><Tag label={c.status}/></div><p className="mt-2 text-sm text-slate-600">{c.objective}</p><details className="mt-2 text-sm text-slate-600"><summary className="cursor-pointer text-teal-800">Lihat brief dan script</summary><p className="mt-2 whitespace-pre-wrap">{c.brief}</p>{c.script && <p className="mt-2 whitespace-pre-wrap">{c.script}</p>}{c.reference_url && <a href={c.reference_url} target="_blank" rel="noreferrer" className="mt-2 block text-teal-800 underline">Aset dan referensi</a>}</details></article>)}{quest.contents.length===0 && <p className="text-sm text-slate-500">Belum ada konten.</p>}</div>
                    </Block>
                </div>}
                {active === "sidequest" && <div className="space-y-5">
                    <Block title="Ajukan Sidequest" detail="Semua divisi boleh request. Deadline yang diminta belum otomatis menjadi deadline komitmen.">
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void send("/app/quest/sidequests",sidequest);}}>
                            <Field label="Jenis pekerjaan (slug)"><input required pattern="[a-z][a-z0-9_-]+" className={input} value={sidequest.kind} onChange={e=>setSidequest({...sidequest,kind:e.target.value})} placeholder="poster, reels, carousel"/></Field>
                            <Field label="Judul request"><input required maxLength={160} className={input} value={sidequest.title} onChange={e=>setSidequest({...sidequest,title:e.target.value})}/></Field>
                            <Field label="Tujuan dan konteks"><input required className={input} value={sidequest.objective} onChange={e=>setSidequest({...sidequest,objective:e.target.value})}/></Field>
                            <Field label="Deadline diminta (WIB)"><input required type="datetime-local" className={input} value={sidequest.requested_due_at} onChange={e=>setSidequest({...sidequest,requested_due_at:e.target.value})}/></Field>
                            <Field label="Link referensi / aset"><input type="url" className={input} value={sidequest.reference_url} onChange={e=>setSidequest({...sidequest,reference_url:e.target.value})} placeholder="https://drive.google.com/..."/></Field>
                            <div className="sm:col-span-2"><Field label="Brief dan pesan yang harus disampaikan"><textarea required rows={4} className={input} value={sidequest.brief} onChange={e=>setSidequest({...sidequest,brief:e.target.value})}/></Field></div>
                            <div className="sm:col-span-2"><button disabled={busy} className={btn}>Ajukan request</button></div>
                        </form>
                    </Block>
                    <Block title={monitor ? "Permintaan lintas divisi" : "Sidequest saya"} detail="Permintaan baru yang tidak memenuhi aturan akan masuk Exception Inbox Head.">
                        <div className="space-y-3">{quest.requests.map(q=><article key={q.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs uppercase text-teal-700">{q.kind} · #{q.id}</p><h3 className="mt-1 font-semibold">{q.title}</h3></div><Tag label={q.status} warn={q.status==="exception"}/></div><p className="mt-2 text-sm text-slate-600">{q.objective}</p><p className="mt-2 text-xs text-slate-500">Deadline diminta: {dateWIB(q.requested_due_at)}</p>{q.reference_url && <a className="mt-2 inline-block text-xs text-teal-800 underline" href={q.reference_url} rel="noreferrer" target="_blank">Referensi</a>}</article>)}{quest.requests.length===0 && <p className="text-sm text-slate-500">Belum ada permintaan.</p>}</div>
                    </Block>
                </div>}
                {active === "exceptions" && monitor && <Block title="Exception Inbox" detail="Hanya Head bisa mengambil keputusan. SPV dan Owner hanya memonitor. Jadwal existing tidak digeser otomatis.">
                    <div className="space-y-3">{quest.exceptions.map(e=><ExceptionCard key={e.id} item={e} canDecide={head} send={send} busy={busy}/>)}{quest.exceptions.length===0 && <p className="text-sm text-slate-500">Belum ada exception.</p>}</div>
                </Block>}
                {active === "policies" && head && <div className="space-y-5">
                    <Block title="Aturan lead time & effort" detail="Tidak ada auto-accept sebelum jenis pekerjaan, PIC, dan SLA dikonfigurasi. Angka di bawah harus disepakati tim.">
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void send("/app/quest/policies",{kind:policy.kind,lead_minutes:Number(policy.lead_minutes),effort_minutes:Number(policy.effort_minutes),assignee_id:Number(policy.assignee_id),checklist_text:policy.checklist_text});}}>
                            <Field label="Jenis pekerjaan"><input required className={input} placeholder="poster" value={policy.kind} onChange={e=>setPolicy({...policy,kind:e.target.value})}/></Field>
                            <Field label="Default PIC"><select required className={input} value={policy.assignee_id} onChange={e=>setPolicy({...policy,assignee_id:e.target.value})}><option value="">Pilih PIC</option>{staff.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                            <Field label="Minimum lead time (menit)"><input required type="number" min={0} className={input} value={policy.lead_minutes} onChange={e=>setPolicy({...policy,lead_minutes:e.target.value})}/></Field>
                            <Field label="Estimasi effort (menit)"><input required type="number" min={15} max={720} className={input} value={policy.effort_minutes} onChange={e=>setPolicy({...policy,effort_minutes:e.target.value})}/></Field>
                            <div className="sm:col-span-2"><Field label="Checklist template (satu poin per baris)"><textarea required rows={3} className={input} value={policy.checklist_text} onChange={e=>setPolicy({...policy,checklist_text:e.target.value})}/></Field></div>
                            <div className="sm:col-span-2"><button disabled={busy} className={btn}>Simpan aturan</button></div>
                        </form>
                        <div className="mt-4 space-y-2 text-sm">{quest.policies.map(p=><p key={p.kind} className="rounded-lg bg-slate-50 p-3">{p.kind} · Lead {p.lead_minutes} menit · Effort {p.effort_minutes} menit · PIC #{p.assignee_id}</p>)}</div>
                    </Block>
                    <Block title="Kalender kerja & kapasitas PIC" detail="Workdays: 1 Senin sampai 7 Ahad. Tidak ada kapasitas otomatis sebelum diset manual.">
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void send("/app/quest/capacity",{id:Number(capacity.memberID),capacity_minutes:Number(capacity.capacity_minutes),start_minute:Number(capacity.start_minute),workdays:capacity.workdays});}}>
                            <Field label="PIC"><select required className={input} value={capacity.memberID} onChange={e=>setCapacity({...capacity,memberID:e.target.value})}><option value="">Pilih PIC</option>{staff.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                            <Field label="Jam kerja efektif (menit/hari)"><input required type="number" min={0} max={720} className={input} value={capacity.capacity_minutes} onChange={e=>setCapacity({...capacity,capacity_minutes:e.target.value})}/></Field>
                            <Field label="Mulai kerja (menit sejak 00.00 WIB)"><input required type="number" min={0} max={1439} className={input} value={capacity.start_minute} onChange={e=>setCapacity({...capacity,start_minute:e.target.value})}/></Field>
                            <Field label="Hari kerja ISO"><input className={input} value={capacity.workdays} onChange={e=>setCapacity({...capacity,workdays:e.target.value})} placeholder="Contoh: 12345"/></Field>
                            <div className="sm:col-span-2"><button disabled={busy} className={btn}>Simpan kapasitas</button></div>
                        </form>
                        <div className="mt-4 space-y-2 text-sm">{staff.map(m=><p key={m.id} className="rounded-lg bg-slate-50 p-3">{m.name} · {m.capacity_minutes} menit/hari · Hari {m.workdays || "belum diatur"}</p>)}</div>
                    </Block>
                </div>}
                {active === "team" && identity.system_admin && <Block title="Penetapan role" detail="Hanya admin sistem yang boleh mengubah role. Pengaturan ini tidak mengubah role admin/user pada autentikasi bawaan.">
                    <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void send("/app/quest/members",{id:Number(memberID),role:memberRole,capacity_minutes:selectedMember?.capacity_minutes || 0,start_minute:selectedMember?.start_minute ?? 540,workdays:selectedMember?.workdays || ""});}}>
                        <Field label="Pengguna"><select required className={input} value={memberID} onChange={e=>{setMemberID(e.target.value);setMemberRole(quest.members.find(m=>String(m.id)===e.target.value)?.role || "requester");}}><option value="">Pilih pengguna</option>{quest.members.map(m=><option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></Field>
                        <Field label="Role aplikasi"><select className={input} value={memberRole} onChange={e=>setMemberRole(e.target.value)}>{Object.entries(roleNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
                        <div className="sm:col-span-2"><button disabled={busy} className={btn}>Tetapkan role</button></div>
                    </form>
                    <div className="mt-5 space-y-2">{quest.members.map(m=><div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">{m.name} <span className="font-normal text-slate-500">({m.email})</span></span><Tag label={roleNames[m.role] || m.role}/></div>)}</div>
                </Block>}
                <footer className="mt-10 text-xs text-slate-400">Quest Multimedia · Ruang Sanad · Semua waktu operasional ditampilkan dalam WIB. Perubahan keputusan dicatat di activity log.</footer>
            </main>
        </div>
    </div>;
}
