-- +goose Up
-- +goose StatementBegin
-- Separate application roles from the starter template's admin/user auth role.
CREATE TABLE quest_memberships (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('head','strategist','smm','editor','requester','spv','owner')),
  capacity_minutes INTEGER NOT NULL DEFAULT 0 CHECK (capacity_minutes BETWEEN 0 AND 720),
  start_minute INTEGER NOT NULL DEFAULT 540 CHECK (start_minute BETWEEN 0 AND 1439),
  workdays TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Policies must be configured before a routine request can be auto-accepted.
CREATE TABLE quest_policies (
  kind TEXT PRIMARY KEY,
  lead_minutes INTEGER NOT NULL CHECK (lead_minutes >= 0),
  effort_minutes INTEGER NOT NULL CHECK (effort_minutes BETWEEN 15 AND 720),
  assignee_id INTEGER NOT NULL REFERENCES users(id),
  checklist_text TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE quest_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  brief TEXT NOT NULL,
  script TEXT NOT NULL DEFAULT '',
  platforms TEXT NOT NULL DEFAULT '',
  reference_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','production','approved','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE quest_sidequests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  brief TEXT NOT NULL,
  reference_url TEXT NOT NULL DEFAULT '',
  requested_due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('needs_info','pending','accepted','exception','rejected','completed','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quest_sidequests_requester ON quest_sidequests(requester_id, created_at DESC);

CREATE TABLE quest_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('content','sidequest')),
  source_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  assignee_id INTEGER REFERENCES users(id),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  effort_minutes INTEGER CHECK (effort_minutes IS NULL OR effort_minutes BETWEEN 15 AND 720),
  committed_due_at TEXT,
  result_url TEXT NOT NULL DEFAULT '',
  scheduled_start TEXT,
  scheduled_end TEXT,
  status TEXT NOT NULL DEFAULT 'blocked'
    CHECK (status IN ('blocked','queued','in_progress','review','done','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quest_tasks_assignee ON quest_tasks(assignee_id, status, scheduled_start);
CREATE INDEX idx_quest_tasks_source ON quest_tasks(source_type, source_id);

CREATE TABLE quest_dependencies (
  task_id INTEGER NOT NULL REFERENCES quest_tasks(id) ON DELETE CASCADE,
  depends_on_id INTEGER NOT NULL REFERENCES quest_tasks(id) ON DELETE RESTRICT,
  PRIMARY KEY(task_id, depends_on_id),
  CHECK(task_id <> depends_on_id)
);

CREATE TABLE quest_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES quest_tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0,1))
);

CREATE TABLE quest_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL UNIQUE REFERENCES quest_tasks(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  decided_by INTEGER REFERENCES users(id),
  decision_note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quest_exceptions_status ON quest_exceptions(status, created_at DESC);

CREATE TABLE quest_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quest_activity_entity ON quest_activity(entity_type, entity_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS quest_activity;
DROP TABLE IF EXISTS quest_exceptions;
DROP TABLE IF EXISTS quest_checklist;
DROP TABLE IF EXISTS quest_dependencies;
DROP TABLE IF EXISTS quest_tasks;
DROP TABLE IF EXISTS quest_sidequests;
DROP TABLE IF EXISTS quest_contents;
DROP TABLE IF EXISTS quest_policies;
DROP TABLE IF EXISTS quest_memberships;
-- +goose StatementEnd
