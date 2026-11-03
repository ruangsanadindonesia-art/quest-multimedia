# PROJECT STATE

PROJECT: Quest Multimedia
REPOSITORY: ruangsanadindonesia-art/quest-multimedia
DEFAULT_BRANCH: main
WORKING_BRANCH: feature/quest-operations-v1
BASE_COMMIT: a237379c0ed2cbce576adc88a9b61099e88be87e
CODE_COMMIT: ff62156af8b5ebaf832bbd081360c5ec7aa0f312
PR: https://github.com/ruangsanadindonesia-art/quest-multimedia/pull/4 (DRAFT)
TARGET: Development / GitHub only
PRODUCTION: NOT DEPLOYED / NOT VERIFIED

## CURRENT OBJECTIVE
Build the first Quest Multimedia production-management vertical slice from the confirmed MVP handoff: unified task queue, requests across divisions, explicit roles, brief, checklist, scheduling and controlled exceptions.

## VERIFIED FACTS
- main contains merged bootstrap PR #3; default Go Fiber + React 19 + Inertia + SQLite.
- Branch feature/quest-operations-v1 uses only non-deployment pull_request verification workflow.
- Existing Dashboard Ruang Sanad is a different repository and was not touched.
- User-supplied handoff is Quest Multimedia MVP v1.0; full multi-platform publishing and analytics are not yet implemented.
- New migrations run automatically when this application starts against its configured database. No server/application was started by the AI.

## COMPLETED
- Additive migration 0006: quest roles, policies, content items, sidequests, production tasks, checklists, dependencies metadata, exceptions and activity log.
- Scoped Quest role assignment; default role requester. System admin assigns Quest roles; Head owns SLA, capacity, final approvals and exception decisions.
- Content brief and multi-task assignment; Sidequest intake; explicit lead-time and capacity checking.
- Deterministic earliest-slot scheduler using Asia/Jakarta working times; existing allocations never silently displaced.
- My Quest displays assigned work across sources, brief, linked references, checklist, slot, due date and result URL.
- Checklist gating, Head-only revision/final approval, exception replan/reject, and audit events.
- Responsive React Quest Workspace with role-specific sections.
- Targeted Go integration tests and scheduler tests.

## CHANGED FILES
- migrations/0006_quest_operations.sql
- app/questops/{scheduler,store,rules,create,tasks}.go and *_test.go
- app/handlers/quest.go
- routes/web.go
- cmd/laju-go/main.go
- frontend/src/pages/app/QuestWorkspace.tsx
- docs/QUEST_OPERATIONS_V1.md

## VERIFICATION
- PASS: GitHub Actions run https://github.com/ruangsanadindonesia-art/quest-multimedia/actions/runs/41602421838
- Evidence bound to code SHA: ff62156af8b5ebaf832bbd081360c5ec7aa0f312
- PASS: npm ci, TS typecheck, Vite build, go vet, go test ./..., Go build, ephemeral login page HTTP smoke, Docker build.
- PASS: targeted questops tests include Goose migrations, role boundaries, requester isolation, checklist gating and capacity conflict.
- NOT VERIFIED: authenticated browser E2E, cross-division pilot, production runtime, server deployment.
- PR #4: DRAFT, NOT MERGED.

## LOCKED DECISIONS
- One standalone web app, one main SQLite database, role-level permissions enforced in backend.
- Head only for final creative approval and schedule exceptions; requester cannot assign urgency.
- Sidequests and content tasks enter one queue; no silent displacement.
- Capacity/lead-time/effort configuration is explicit, never invented. Dates are WIB UI / UTC storage.
- No production migrations, SSH, deployment or manual-server actions by AI.

## KNOWN LIMITATIONS
- Dependency records exist but dependency editing and schedule eligibility by dependency are deferred.
- Publishing Queue, multi-platform publication records, performance/CS reconciliation, Google Sheets import, notifications, and detailed holiday calendars are not implemented.
- Existing Go module path still points to upstream; inherited public repo and source licensing require review.
- Business-team role accounts, SLA defaults and effort estimates are not seeded; administrator/Head must configure them before pilot.
- No authenticated end-to-end user browser smoke or production proof.

## DO NOT REDO
- Do not repeat bootstrap investigation or infer that PR CI is proof of production deployment.
- Do not overwrite, merge into, or modify the separate Ruang Sanad dashboard.
- Do not auto-merge PR #4 or deploy without explicit approval.

## NEXT ACTION
1. Review draft PR #4, run a controlled browser pilot with actual team roles and chosen SLA/capacity.
2. Prioritize dependencies, schedule proposal versioning, scope-change log and publishing workflow in subsequent vertical slices.
3. Keep merge/deploy separate and manual production operations user-executed.
