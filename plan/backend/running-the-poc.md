# Running LTRide locally

How to bring the app up on your own machine — the database, the Flask API, and
the React UI — so you can log in and try your changes end-to-end. Paths are
relative to the repo root (`lt-parking-site-project/`).

There are two ways to run it:

- **[§0 Quick start](#0-quick-start-recommended)** — one command (`scripts/local.sh`).
  Uses Docker for Postgres. **Recommended for everyone.**
- **[§1–§8 Manual setup](#1-prerequisites-manual-path)** — run each piece by hand
  against a native Postgres. Use this if you can't run Docker, or want to understand
  each moving part.

---

## 0. Quick start (recommended)

One script starts everything and waits until it is healthy: a **Postgres**
database (in Docker), the **Flask API** (native), and the **Vite** dev server for
the **React UI** (native).

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/),
[Node.js 18+](https://nodejs.org/), and Python 3. Nothing else to install by hand —
the first `up` creates the database, applies migrations + seed data, builds the
backend virtualenv, and writes a local `backend/.env` for you.

```bash
scripts/local.sh up        # start Postgres + API + UI (first run also sets everything up)
scripts/local.sh restart   # re-run after you change code
scripts/local.sh down      # stop everything (keeps the database data)
```

Once it is up:

- **UI:** http://localhost:5173
- **API health:** http://localhost:8000/api/health
- **Seeded logins (local dev only):** `admin` / `admin123`, or student codes `STU001`–`STU004`

Other commands:

| Command | What it does |
|---------|--------------|
| `scripts/local.sh status`   | Show whether the UI, API, and database are running |
| `scripts/local.sh logs`     | Follow the API + UI logs (Ctrl-C to detach) |
| `scripts/local.sh migrate`  | Re-apply `sql/migrations` against the running database |
| `scripts/local.sh seed`     | Reload the sample data (re-runnable) |
| `scripts/local.sh psql`     | Open a `psql` shell inside the database container |
| `scripts/local.sh down-all` | Stop and **delete** the database container + its data (fresh DB next `up`) |

Override any default with an environment variable, e.g. a different API port:

```bash
LTRIDE_BACKEND_PORT=9000 scripts/local.sh up
```

(Others: `LTRIDE_FRONTEND_PORT`, `LTRIDE_DB_PORT`, `LTRIDE_DB_NAME`,
`LTRIDE_DB_USER`, `LTRIDE_DB_PASSWORD`, `LTRIDE_DB_CONTAINER`.)

> **Windows:** run `scripts/local.sh` from **Git Bash** (bundled with
> [Git for Windows](https://git-scm.com/download/win)) or **WSL** — it is a bash
> script. Docker Desktop must be running. If you would rather not use Docker at all,
> follow the manual path below with a native Postgres.

That is all most people need. The rest of this page is the manual path.

---

## 1. Prerequisites (manual path)

- **Python 3** (used for the `backend/.venv` virtualenv).
- **PostgreSQL 16** running locally.
- **Node 18+** — for the React frontend in `frontend/`.

Install them:

**macOS / Linux**

```bash
brew install postgresql@16 && brew services start postgresql@16
# Python 3 and Node 18+ via python.org / your package manager.
```

**Windows (PowerShell)**

```powershell
winget install Python.Python.3.12
winget install PostgreSQL.PostgreSQL.16   # installs & starts the "postgresql-x64-16" service
winget install OpenJS.NodeJS.LTS
```

Check they are available:

**macOS / Linux**

```bash
python3 --version         # 3.x
psql --version            # PostgreSQL 16.x
pg_isready                # accepting connections
node --version            # v18+
```

**Windows (PowerShell)**

```powershell
python --version          # 3.x
psql --version            # PostgreSQL 16.x
pg_isready                # accepting connections
node --version            # v18+
```

> On Windows, if `psql` / `createdb` / `pg_isready` are not found, add the Postgres
> `bin` folder (e.g. `C:\Program Files\PostgreSQL\16\bin`) to your `PATH`.

---

## 2. One-time setup

### 2a. Python virtualenv + dependencies

The backend uses a virtualenv at `backend/.venv`. Create it and install the deps:

**macOS / Linux**

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/webapp/requirements.txt
```

**Windows (PowerShell)**

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\pip install -r backend\webapp\requirements.txt
```

### 2b. Environment variables (`backend/.env`)

The backend reads config from `backend/.env` (loaded by
`backend/webapp/App/config.py`). `SECRET_KEY` and `DATABASE_URL` are **required** —
the app refuses to start without them.

Create `backend/.env` with the two required keys:

```dotenv
# Sign JWTs — use a long random string in production.
SECRET_KEY=change-me-to-a-long-random-string

# Local dev database.
DATABASE_URL=postgresql://localhost/ltride
```

Two more settings are optional — add them only to override their defaults:

- `CORS_ORIGINS` (default `http://localhost:5173`) — web origins allowed to call
  the API; the default matches the React dev server.
- `JWT_EXP_HOURS` (default `12`) — how long a login token stays valid.

`backend/.env` is git-ignored and must never be committed.

### 2c. Create the database

```bash
createdb ltride
```

### 2d. Create the tables and load seed data

**macOS / Linux**

```bash
psql -d ltride -f backend/webapp/sql/migrations/001_init.sql   # schema (drops + recreates)
psql -d ltride -f backend/webapp/sql/seed.sql                  # demo lots, spaces, students
```

**Windows (PowerShell)**

```powershell
psql -d ltride -f backend\webapp\sql\migrations\001_init.sql    # schema (drops + recreates)
psql -d ltride -f backend\webapp\sql\seed.sql                   # demo lots, spaces, students
```

The seed includes a **dev-only** admin (`admin` / `admin123`) and four student
login codes (`STU001`–`STU004`). For anything beyond local demos, create your own
admin (next section) and do not rely on the seeded credentials.

---

## 3. Add an admin user

Use the helper script — it hashes the password (werkzeug scrypt) and writes the
`users` row that `POST /api/auth/admin` checks against. This is a bash script; on
Windows run it from **Git Bash** or **WSL**.

```bash
./backend/webapp/bin/add-admin --username admin --name "Site Admin" --email admin@lt.edu
```

It prompts for the password twice (hidden). Flags:

| Flag | Purpose |
|------|---------|
| `--username` | Admin login name (required) |
| `--name` | Display name (defaults to the username) |
| `--email` | Contact email |
| `--password` | Skip the prompt — avoid on shared shells (lands in history) |
| `--force` | Reset the password of an admin that already exists |

Reset a forgotten password (keeps the existing name/email):

```bash
./backend/webapp/bin/add-admin --username admin --force
```

Target a different database for one command:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ltride_prod" ./backend/webapp/bin/add-admin --username admin
```

The script writes to the DB directly — the server does not need to be running.

---

## 4. Start / stop the server

Use the dev-server script (`backend/webapp/bin/server`). This is a bash script; on
Windows run it from **Git Bash** or **WSL**.

```bash
./backend/webapp/bin/server start      # launch on http://127.0.0.1:8000
./backend/webapp/bin/server status     # is it running?
./backend/webapp/bin/server stop       # stop it
./backend/webapp/bin/server restart    # stop then start
```

Override host/port with env vars:

```bash
LTRIDE_PORT=9000 ./backend/webapp/bin/server start
```

Runtime files land in `backend/webapp/var/` (pid + log, both git-ignored). Tail the log:

**macOS / Linux**

```bash
tail -f backend/webapp/var/dev-server.log
```

**Windows (PowerShell)**

```powershell
Get-Content backend\webapp\var\dev-server.log -Wait -Tail 20
```

---

## 5. Verify it works

On Windows, PowerShell's `Invoke-RestMethod` is cleaner than `curl` for JSON bodies
(no quote-escaping headaches); it prints the parsed response.

Health check:

**macOS / Linux**

```bash
curl -s http://127.0.0.1:8000/api/health
# {"data":{"status":"ok","time":"..."}}
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Admin login (returns a JWT):

**macOS / Linux**

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/admin \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
# {"data":{"token":"...","user":{"id":...,"role":"admin",...}}}
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/auth/admin `
  -ContentType application/json `
  -Body '{"username":"admin","password":"YOUR_PASSWORD"}'
```

Student login (seeded code):

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}'
```

---

## 6. Run the smoke test (optional)

End-to-end check of every endpoint against a running server. It mutates data, so
re-migrate + re-seed afterward if you want a clean DB. Start the server from Git
Bash / WSL on Windows (see §4).

```bash
./backend/webapp/bin/server start
backend/.venv/bin/python backend/webapp/tests/smoke_api.py http://127.0.0.1:8000
# ... == 67 passed, 0 failed ==

# restore a clean database
psql -d ltride -f backend/webapp/sql/migrations/001_init.sql
psql -d ltride -f backend/webapp/sql/seed.sql
```

---

## 7. Run the React frontend

The SPA lives in `frontend/` in this repo. Its dev server runs on port `5173`,
which matches the backend's default `CORS_ORIGINS`.

```bash
cd frontend
npm install
VITE_USE_MOCK=false VITE_API_URL=http://localhost:8000 npm run dev   # http://localhost:5173
```

- `VITE_USE_MOCK=false` points the UI at the real API instead of the built-in mock.
- `VITE_API_URL` is where the API is listening (the backend from §4).

Then open http://localhost:5173 and log in with the admin or a student code.

> This is exactly what `scripts/local.sh up` (§0) does for you — Postgres, API, and
> UI together — which is why it is the recommended path.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Cannot connect to the Docker daemon` from `scripts/local.sh` | Docker Desktop is not running — start it, then `scripts/local.sh up`. |
| `KeyError: 'SECRET_KEY'` on startup | `backend/.env` missing or `SECRET_KEY`/`DATABASE_URL` unset — see §2b (or let `scripts/local.sh` create it). |
| `Address already in use` on start | A previous server is still up. Run `scripts/local.sh down` (or `./backend/webapp/bin/server stop`), then start again. |
| `.venv/bin/python not found` (or `backend\.venv\Scripts\python` on Windows) | Virtualenv not created — see §2a. |
| `psql: connection ... failed` (manual path) | PostgreSQL not running. macOS: `brew services start postgresql@16`. Windows: `net start postgresql-x64-16`. |
| `bin/server` / `add-admin` won't run on Windows | These are bash scripts — run them from Git Bash or WSL, not PowerShell/`cmd`. |
| `psql` / `createdb` not found on Windows | Add `C:\Program Files\PostgreSQL\16\bin` to your `PATH`. |
| Login always 401 | Admin not created, or wrong password — recreate with `add-admin --force`, or re-seed. |
