# Quest Multimedia: Operations Vertical Slice v1

This release is **not** the complete MVP from the product handoff. It implements one verifiable operational slice on the existing Go Fiber + React + SQLite stack, without modifying the old Ruang Sanad dashboard.

## Entry point
- `GET /app`: Quest Multimedia workspace, replacing the template's demo dashboard.
- Each authenticated user has a separate **Quest role** read from `quest_memberships`. The existing `users.role=admin/user` remains unchanged.
- Unassigned users are treated as **requester**, not Head or Editor.
- The existing **system admin** can assign Quest roles in the **Role & Akses** tab. Only a Quest **head** can authorize creative approval, SLA policy and schedule exceptions.
- SPV and Owner can monitor but cannot approve, override priorities or change memberships by default.

## Main workflow
1. Strategist/Head creates a **Content Item** with objective, brief and optional script/reference.
2. Head creates one or more production tasks for the content, each with one PIC, priority, effort, due date and required checklist.
3. An authenticated requester from any division may submit a **Sidequest** with title, kind, objective, brief and requested deadline.
4. A Sidequest is auto-scheduled only when its kind has a Head-configured policy (lead time, effort, assignee and checklist), the lead time passes, and a non-overlapping slot is available.
5. Otherwise a **blocked task** and **Exception Inbox** record are created. Missing policy, short notice and capacity conflict never displace existing tasks silently.
6. Assigned staff see work from both sources in **My Quest**, including brief, reference, checklist, scheduled slot, and committed deadline.
7. The PIC checks every checklist item and submits a HTTPS link. Head may request revision with a recorded reason or give final approval.
8. Head may replan a blocked task against a different proposed due date, or reject it with a reason. Existing allocations are never shifted automatically.

## Time and capacity
- All user-facing date/time inputs are interpreted as **WIB UTC+7** and stored as RFC3339 UTC timestamps.
- Capacity and working days **must be configured**, without assuming any schedule for staff. `workdays` uses ISO digits 1=Monday through 7=Sunday. `start_minute` counts minutes after midnight WIB.
- The scheduler searches earliest free 15-minute slot inside each configured working day, while respecting the requested/committed deadline. Tasks exceeding one day's capacity should be split into multiple tasks.
- Pending exception `requested_due_at` remains a **request**, not a confirmed delivery commitment. `committed_due_at` is set only after scheduling.
- Scheduling uses a SQLite `BEGIN IMMEDIATE` transaction so two requests cannot claim the same slot within the single shared database.

## Backend security
- All `/app/quest/*` POST routes inherit authenticated session and existing CSRF middleware.
- The server reads Quest membership from SQLite; it never trusts the role or assignee supplied by the browser.
- Requesters only read their own Sidequests and cannot inspect internal task/Content/Exception records; Editor/SMM read their assigned tasks.
- Role assignment uses the existing system-admin flag, capacity/policy/exception decisions require the authorized role, and task mutations require the assigned PIC or Head as applicable.
- Changes write `quest_activity`; operations use archive/status rather than hard-delete.

## What is not yet implemented
The handoff's complete MVP remains larger. The following are explicitly deferred: editable task dependencies and deterministic dependency resolution; full multi-platform publication records, platform approvals and Publishing Queue; calendar-style editing; automated notifications/escalation reminders; detailed per-PIC workday exceptions/holidays; explicit schedule proposal versions and impact comparison; shared team task templates beyond per-kind Sidequest checklists; CS reconciliation, performance, Google Sheets import, Google Drive API integrations, reports, and comprehensive browser E2E/security tests.

The current scheduler does not automatically reschedule existing commitments. The first pilot must calibrate effort and lead-time policies with the actual team before relying on workload indicators.

## Verification
Run GitHub PR CI for React typecheck, Vite build, Go vet/tests/build, login-page smoke and Docker image build. The targeted `questops` tests check migration, requester isolation, Head authority, checklist gating and capacity conflict. CI is **not** a production deployment.

## Operations
No production database migration or VPS operation should be run by the AI. After merge, the user manages deployment/setup separately with backups, explicit migration evidence and changed-flow smoke tests. Avoid putting API keys or user credentials into issues or commit logs.
