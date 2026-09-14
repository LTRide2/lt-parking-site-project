#!/usr/bin/env bash
# Bring the full LTRide stack up locally for testing, with one command: a
# Postgres database (Docker), the Flask API (native), and the Vite dev server
# (native). This is what you run to check your changes end-to-end as you work
# through the lessons. See plan/backend/running-the-poc.md for details.
#
# Commands: up | down | down-all | restart | status | logs | migrate | seed | psql
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

# --- Configuration (override any of these via environment variables) ---
frontend_directory="frontend"
backend_directory="backend"
webapp_directory="backend/webapp"
runtime_directory=".local"                       # gitignored: holds pid + log files

backend_port="${LTRIDE_BACKEND_PORT:-8000}"
frontend_port="${LTRIDE_FRONTEND_PORT:-5173}"

database_container="${LTRIDE_DB_CONTAINER:-ltride-local-db}"
database_host_port="${LTRIDE_DB_PORT:-5432}"
database_name="${LTRIDE_DB_NAME:-ltride}"
database_user="${LTRIDE_DB_USER:-ltride}"
database_password="${LTRIDE_DB_PASSWORD:-ltride}"
database_url="postgresql://${database_user}:${database_password}@localhost:${database_host_port}/${database_name}"

backend_pid_file="${runtime_directory}/backend.pid"
frontend_pid_file="${runtime_directory}/frontend.pid"
backend_log_file="${runtime_directory}/backend.log"
frontend_log_file="${runtime_directory}/frontend.log"

# --- Small helpers ---
require_command() {
  # require_command <name> "<install hint>"
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "required command '$1' is not installed$2" >&2
    exit 1
  fi
}

run_in_database() {
  # Run psql inside the container. SQL comes from stdin or extra args.
  docker exec -i "$database_container" \
    psql -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" "$@"
}

# --- Database (Docker Postgres) ---
start_database() {
  require_command docker " — install Docker Desktop: https://www.docker.com/products/docker-desktop/"
  if docker ps --format '{{.Names}}' | grep -qx "$database_container"; then
    echo "postgres container '$database_container' already running"
  elif docker ps -a --format '{{.Names}}' | grep -qx "$database_container"; then
    echo "starting existing postgres container '$database_container'..."
    docker start "$database_container" >/dev/null
  else
    echo "creating postgres container '$database_container' on port $database_host_port..."
    docker run -d --name "$database_container" \
      -e POSTGRES_USER="$database_user" \
      -e POSTGRES_PASSWORD="$database_password" \
      -e POSTGRES_DB="$database_name" \
      -p "${database_host_port}:5432" \
      postgres:16 >/dev/null
  fi
  wait_for_database
}

wait_for_database() {
  echo "waiting for postgres to accept connections..."
  for attempt in $(seq 1 30); do
    if docker exec "$database_container" \
        pg_isready -U "$database_user" -d "$database_name" >/dev/null 2>&1; then
      echo "postgres ready"
      return 0
    fi
    sleep 1
  done
  echo "postgres did not become ready in time" >&2
  return 1
}

database_is_initialized() {
  # True once the first migration has created the 'users' table.
  run_in_database -tAc "SELECT to_regclass('public.users') IS NOT NULL;" 2>/dev/null \
    | grep -qx t
}

initialize_database() {
  local migrations_directory="${webapp_directory}/sql/migrations"
  if [ ! -d "$migrations_directory" ]; then
    echo "no migrations at ${migrations_directory} yet — skipping schema setup." \
         "(Still on the scaffold? local.sh targets the real Postgres backend you"
    echo "build in the B-lessons; the UI runs regardless.)"
    return 0
  fi
  if database_is_initialized; then
    echo "database schema already present — skipping migrations"
  else
    echo "applying migrations..."
    for migration_file in "$migrations_directory"/*.sql; do
      [ -e "$migration_file" ] || continue
      echo "  - $(basename "$migration_file")"
      run_in_database < "$migration_file"
    done
  fi
  seed_database
}

seed_database() {
  if [ -f "${webapp_directory}/sql/seed.sql" ]; then
    echo "seeding sample data (re-runnable)..."
    run_in_database < "${webapp_directory}/sql/seed.sql"
  fi
}

# --- Backend (native Flask dev server) ---
ensure_backend_dependencies() {
  require_command python3 " — install Python 3: https://www.python.org/downloads/"
  local virtualenv_directory="${backend_directory}/.venv"
  if [ ! -d "$virtualenv_directory" ]; then
    echo "creating backend virtualenv at ${virtualenv_directory}..."
    python3 -m venv "$virtualenv_directory"
  fi
  echo "installing backend dependencies..."
  "${virtualenv_directory}/bin/pip" install --quiet --upgrade pip
  "${virtualenv_directory}/bin/pip" install --quiet -r "${webapp_directory}/requirements.txt"
}

ensure_backend_env() {
  # The real backend refuses to start without SECRET_KEY + DATABASE_URL. Create
  # a local .env once (gitignored); never overwrite an existing one.
  local env_file="${backend_directory}/.env"
  if [ -f "$env_file" ]; then
    return 0
  fi
  echo "creating ${env_file} (gitignored) for local development..."
  local generated_secret_key
  generated_secret_key="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  {
    echo "SECRET_KEY=${generated_secret_key}"
    echo "DATABASE_URL=${database_url}"
    echo "CORS_ORIGINS=http://localhost:${frontend_port}"
  } > "$env_file"
}

start_backend() {
  ensure_backend_dependencies
  ensure_backend_env
  echo "starting Flask API on http://localhost:${backend_port} ..."
  # Run from backend/ so gunicorn's "webapp.App:app" import path resolves and
  # config.py's load_dotenv() finds backend/.env. exec so the pid is Flask's.
  (
    cd "$backend_directory" &&
    exec ".venv/bin/flask" --app webapp.App run --host 0.0.0.0 --port "$backend_port"
  ) >"$backend_log_file" 2>&1 &
  echo $! > "$backend_pid_file"
  wait_for_backend
}

wait_for_backend() {
  echo "waiting for GET /api/health ..."
  for attempt in $(seq 1 30); do
    if curl -fsS "http://localhost:${backend_port}/api/health" >/dev/null 2>&1; then
      echo "backend healthy"
      return 0
    fi
    if ! kill -0 "$(cat "$backend_pid_file" 2>/dev/null)" 2>/dev/null; then
      echo "backend process exited early — see ${backend_log_file}" >&2
      return 1
    fi
    sleep 1
  done
  echo "backend did not pass health check in time — see ${backend_log_file}" >&2
  return 1
}

# --- Frontend (native Vite dev server) ---
start_frontend() {
  require_command npm " — install Node.js: https://nodejs.org/"
  if [ ! -d "${frontend_directory}/node_modules" ]; then
    echo "installing frontend dependencies (npm install)..."
    ( cd "$frontend_directory" && npm install )
  fi
  echo "starting Vite dev server on http://localhost:${frontend_port} ..."
  # VITE_USE_MOCK=false points the UI at the real API instead of the mock.
  (
    cd "$frontend_directory" &&
    VITE_USE_MOCK=false \
    VITE_API_URL="http://localhost:${backend_port}" \
    exec npm run dev -- --port "$frontend_port" --host
  ) >"$frontend_log_file" 2>&1 &
  echo $! > "$frontend_pid_file"
  wait_for_frontend
}

wait_for_frontend() {
  echo "waiting for the Vite dev server ..."
  for attempt in $(seq 1 30); do
    if curl -fsS "http://localhost:${frontend_port}/" >/dev/null 2>&1; then
      echo "frontend ready"
      return 0
    fi
    if ! kill -0 "$(cat "$frontend_pid_file" 2>/dev/null)" 2>/dev/null; then
      echo "frontend process exited early — see ${frontend_log_file}" >&2
      return 1
    fi
    sleep 1
  done
  echo "frontend did not come up in time — see ${frontend_log_file}" >&2
  return 1
}

stop_process() {
  # stop_process <pid-file> <label> — stop a server and its children.
  local pid_file="$1" label="$2" pid
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "stopping ${label} (pid ${pid})..."
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

print_endpoints() {
  echo
  echo "up. reachable at:"
  echo "  http://localhost:${frontend_port}/            (LTRide UI — Vite dev server)"
  echo "  http://localhost:${backend_port}/api/health   (Flask API health check)"
  echo
  echo "seeded logins (local dev only): admin / admin123, or student codes STU001–STU004"
  echo "follow logs: scripts/local.sh logs      stop everything: scripts/local.sh down"
}

# --- Commands ---
command_up() {
  mkdir -p "$runtime_directory"
  start_database
  initialize_database
  start_backend
  start_frontend
  print_endpoints
}

command_down() {
  stop_process "$frontend_pid_file" "Vite frontend"
  stop_process "$backend_pid_file" "Flask backend"
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$database_container"; then
    echo "stopping postgres container '$database_container'..."
    docker stop "$database_container" >/dev/null
  fi
}

command_down_all() {
  command_down
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$database_container"; then
    echo "removing postgres container '$database_container' and its data..."
    docker rm -f "$database_container" >/dev/null
  fi
}

command_status() {
  local pid
  for entry in "backend:${backend_pid_file}" "frontend:${frontend_pid_file}"; do
    local label="${entry%%:*}" pid_file="${entry#*:}"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "${label}: running (pid $(cat "$pid_file"))"
    else
      echo "${label}: stopped"
    fi
  done
  echo "database:"
  docker ps --filter "name=${database_container}" \
    --format '  {{.Names}}: {{.Status}}' 2>/dev/null || echo "  (docker unavailable)"
}

command_logs() {
  require_command tail
  echo "following backend + frontend logs (Ctrl-C to stop) ..."
  touch "$backend_log_file" "$frontend_log_file"
  tail -f "$backend_log_file" "$frontend_log_file"
}

usage() {
  cat <<'USAGE'
Usage: scripts/local.sh <command>

  up         Start Postgres (Docker) + Flask API + Vite UI; set up DB & deps on
             first run, then wait until everything is healthy
  down       Stop the UI, API, and Postgres container (keeps the DB data)
  down-all   down, and also delete the Postgres container + its data (fresh DB)
  restart    down, then up — run this to pick up your code changes
  status     Show whether the UI, API, and database are running
  logs       Follow the API + UI logs (Ctrl-C to detach)
  migrate    Apply sql/migrations against the running database only
  seed       Reload sample data (re-runnable)
  psql       Open a psql shell inside the database container
USAGE
}

command_name="${1:-}"
case "$command_name" in
  up)         command_up ;;
  down)       command_down ;;
  down-all)   command_down_all ;;
  restart)    command_down; command_up ;;
  status)     command_status ;;
  logs)       command_logs ;;
  migrate)    start_database; initialize_database ;;
  seed)       start_database; seed_database ;;
  psql)       run_in_database ;;
  ""|-h|--help|help) usage ;;
  *) echo "unknown command: $command_name" >&2; usage; exit 2 ;;
esac
