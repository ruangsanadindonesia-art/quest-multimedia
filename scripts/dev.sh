#!/usr/bin/env bash
# Dev server lifecycle manager for AI agents.
#
#   scripts/dev.sh background        — start air + vite detached, write lock file
#   scripts/dev.sh status            — check if server is running (PID, port, URL)
#   scripts/dev.sh stop              — graceful shutdown + remove lock file
#   scripts/dev.sh logs [--follow]   — view logs (tail -f style with --follow)
#
# Lock file: .laju/dev.json ({ pid, port, url, startedAt })
# Log file:  .laju/dev.log
#
# Human developers: use `npm run dev:all` (foreground) instead.
# Air watches .go files and auto-rebuilds/restarts. Vite watches frontend.
# After editing .templ files: run `templ generate` then wait for air reload.

set -euo pipefail

LOCK_FILE=".laju/dev.json"
LOG_FILE=".laju/dev.log"
READINESS_TIMEOUT=30
READINESS_POLL=0.2
GRACEFUL_SHUTDOWN=5
DEFAULT_PORT="${APP_PORT:-8080}"

mkdir -p .laju

read_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    cat "$LOCK_FILE"
  else
    echo ""
  fi
}

is_process_alive() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

remove_lock() {
  rm -f "$LOCK_FILE"
}

background() {
  local existing
  existing=$(read_lock)
  if [[ -n "$existing" ]]; then
    local existing_pid
    existing_pid=$(echo "$existing" | grep -o '"pid": [0-9]*' | grep -o '[0-9]*')
    if [[ -n "$existing_pid" ]] && is_process_alive "$existing_pid"; then
      local existing_url
      existing_url=$(echo "$existing" | grep -o '"url": "[^"]*"' | sed 's/"url": "//;s/"//')
      echo "Server already running at $existing_url (pid $existing_pid)"
      echo "Run \`scripts/dev.sh stop\` to stop it first."
      return 0
    fi
    remove_lock
  fi

  # Build frontend if dist/ is missing
  if [[ ! -d dist/.vite ]]; then
    echo "Building frontend assets..."
    npm run build >/dev/null 2>&1 || true
  fi

  # Start air + vite in background, output to log file
  # air runs Go with hot reload, vite runs frontend dev server
  : > "$LOG_FILE"

  # Start air + vite in background, output to log file
  npm run dev:all >>"$LOG_FILE" 2>&1 &
  local pid=$!

  if [[ -z "$pid" ]] || ! is_process_alive "$pid"; then
    echo "Failed to spawn dev server."
    cat "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  # Poll log file for the readiness line
  local start_time
  start_time=$(date +%s)
  local url=""
  local port=""

  while true; do
    local elapsed
    elapsed=$(( $(date +%s) - start_time ))
    if [[ $elapsed -ge $READINESS_TIMEOUT ]]; then
      echo "Dev server did not become ready within ${READINESS_TIMEOUT}s. Logs:"
      cat "$LOG_FILE" 2>/dev/null || true
      remove_lock
      exit 1
    fi

    sleep "$READINESS_POLL"

    # Check if process died
    if ! is_process_alive "$pid"; then
      # Check if any child is still alive (concurrently may fork)
      if ! pgrep -f "air\|vite\|main" >/dev/null 2>&1; then
        echo "Dev server exited unexpectedly. Logs:"
        cat "$LOG_FILE" 2>/dev/null || true
        remove_lock
        exit 1
      fi
    fi

    # Parse log for readiness — air prints "running..." then Go prints "server listening"
    if grep -q 'server listening' "$LOG_FILE" 2>/dev/null; then
      port=$(grep 'server listening' "$LOG_FILE" | grep -o 'port=[0-9]*' | grep -o '[0-9]*' | head -1)
      if [[ -z "$port" ]]; then
        port=$(grep -o 'http://127.0.0.1:[0-9]*' "$LOG_FILE" | grep -o '[0-9]*' | head -1)
      fi
      if [[ -z "$port" ]]; then
        port="$DEFAULT_PORT"
      fi
      url="http://localhost:${port}"
      break
    fi
  done

  # Write lock file
  local started_at
  started_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > "$LOCK_FILE" <<EOF
{
  "pid": $pid,
  "port": $port,
  "url": "$url",
  "startedAt": "$started_at"
}
EOF

  echo "Server ready at $url (pid $pid)"
  echo "Logs:  scripts/dev.sh logs"
  echo "Stop:  scripts/dev.sh stop"
}

status() {
  local existing
  existing=$(read_lock)
  if [[ -z "$existing" ]]; then
    echo "No dev server running."
    return 0
  fi

  local pid
  pid=$(echo "$existing" | grep -o '"pid": [0-9]*' | grep -o '[0-9]*')
  if [[ -z "$pid" ]] || ! is_process_alive "$pid"; then
    # Check if any child process is alive
    if ! pgrep -f "air\|vite\|main" >/dev/null 2>&1; then
      echo "Dev server is not running (stale lock removed)."
      remove_lock
      return 0
    fi
  fi

  local url started_at
  url=$(echo "$existing" | grep -o '"url": "[^"]*"' | sed 's/"url": "//;s/"//')
  started_at=$(echo "$existing" | grep -o '"startedAt": "[^"]*"' | sed 's/"startedAt": "//;s/"//')
  echo "Running: $url (pid $pid, started $started_at)"

  # Show recent logs
  if [[ -f "$LOG_FILE" ]]; then
    local lines
    lines=$(tail -3 "$LOG_FILE" 2>/dev/null)
    if [[ -n "$lines" ]]; then
      echo "Recent logs:"
      echo "$lines" | while IFS= read -r line; do echo "  $line"; done
    fi
  fi
}

stop() {
  local existing
  existing=$(read_lock)
  if [[ -z "$existing" ]]; then
    echo "No dev server running."
    return 0
  fi

  local pid
  pid=$(echo "$existing" | grep -o '"pid": [0-9]*' | grep -o '[0-9]*')

  # Kill the process group — concurrently + air + vite + go binary
  if [[ -n "$pid" ]] && is_process_alive "$pid"; then
    kill -TERM "$pid" 2>/dev/null || true
  fi
  # Also kill any orphaned air/vite/main processes
  pkill -f "air\|vite\|tmp/main" 2>/dev/null || true

  local start_time
  start_time=$(date +%s)
  while is_process_alive "$pid" 2>/dev/null; do
    local elapsed
    elapsed=$(( $(date +%s) - start_time ))
    if [[ $elapsed -ge $GRACEFUL_SHUTDOWN ]]; then
      echo "Server did not stop gracefully, sending SIGKILL..."
      kill -KILL "$pid" 2>/dev/null || true
      pkill -KILL -f "air\|vite\|tmp/main" 2>/dev/null || true
      break
    fi
    sleep 0.1
  done

  remove_lock
  echo "Dev server stopped."
}

logs() {
  local follow="${1:-false}"
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "No log file found. Is the server running?"
    return 0
  fi

  if [[ "$follow" == "true" ]]; then
    tail -f "$LOG_FILE"
  else
    tail -50 "$LOG_FILE"
  fi
}

# --- CLI ---

subcommand="${1:-}"
shift || true

case "$subcommand" in
  background)
    background
    ;;
  status)
    status
    ;;
  stop)
    stop
    ;;
  logs)
    follow="false"
    if [[ "${1:-}" == "--follow" || "${1:-}" == "-f" ]]; then
      follow="true"
    fi
    logs "$follow"
    ;;
  *)
    echo "Usage: scripts/dev.sh <command> [flags]

Commands:
  background         Start dev server in background (writes .laju/dev.json)
  status             Check if dev server is running
  stop               Stop the background dev server
  logs [--follow]    View logs (tail -f with --follow)

Human developers: use \`npm run dev:all\` instead."
    ;;
esac
