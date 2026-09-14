# Running the LTRide PoC (backend)

A step-by-step runbook to bring the backend up on a fresh machine, create the
initial admin, and verify it works. Paths are relative to the repo root
(`LTR-Backend/`).

Each step gives two variants side by side — **macOS / Linux** (bash, Homebrew)
and **Windows (PowerShell)**. Pick the one for your OS.

> **Windows note:** `webapp/bin/add-admin` and `webapp/bin/server` are `#!/bin/bash`
> scripts and do not run in PowerShell or `cmd`. On Windows, run those two commands
> from **Git Bash** (bundled with [Git for Windows](https://git-scm.com/download/win))
> or **WSL** — the bash snippets in §3, §4, and §6 work unchanged there. Everything
> else has a native PowerShell equivalent below.

---

## 1. Prerequisites

- **Python 3.14** (the repo `.venv` is built on it).
- **PostgreSQL 16** running locally.
- **Node 18+** — only if you also want to run the React frontend.

Install them:

**macOS / Linux**

```bash
brew install postgresql@16 && brew services start postgresql@16
# Python 3.14 and Node 18+ via python.org / your package manager.
```

**Windows (PowerShell)**

```powershell
winget install Python.Python.3.14
winget install PostgreSQL.PostgreSQL.16   # installs & starts the "postgresql-x64-16" service
winget install OpenJS.NodeJS.LTS          # only if running the frontend
```

Check they are available:

**macOS / Linux**

```bash
python3 --version         # 3.14.x
psql --version            # PostgreSQL 16.x
pg_isready                # accepting connections
```

**Windows (PowerShell)**

```powershell
python --version          # 3.14.x
psql --version            # PostgreSQL 16.x
pg_isready                # accepting connections
```

> On Windows, if `psql` / `createdb` / `pg_isready` are not found, add the Postgres
> `bin` folder (e.g. `C:\Program Files\PostgreSQL\16\bin`) to your `PATH`.

---

## 2. One-time setup

### 2a. Python virtualenv + dependencies

The project uses the repo-root `.venv`. Create it and install the deps:

**macOS / Linux**

```bash
python3 -m venv .venv
.venv/bin/pip install -r webapp/requirements.txt
```

**Windows (PowerShell)**

```powershell
python -m venv .venv
.venv\Scripts\pip install -r webapp\requirements.txt
```

> The stale `webapp/env/` virtualenv points at a non-existent interpreter — ignore it.
> All scripts use `.venv/`.

### 2b. Environment variables (`.env`)

The app reads config from a `.env` file at the repo root (loaded by
`webapp/App/config.py`). `SECRET_KEY` and `DATABASE_URL` are **required** — the
app refuses to start without them.

Create `.env` in the repo root with the two required keys:

```dotenv
# Sign JWTs — use a long random string in production.
SECRET_KEY=change-me-to-a-long-random-string

# Local dev database.
DATABASE_URL=postgresql://localhost/ltride_dev
```

Create the file:

**macOS / Linux**

```bash
$EDITOR .env        # or: touch .env, then paste the keys above
```

**Windows (PowerShell)**

```powershell
notepad .env        # creates the file, then paste the keys above and save
```

Two more settings are optional — add them only to override their defaults:

- `CORS_ORIGINS` (default `http://localhost:5173`) — web origins allowed to call
  the API; the default matches the React dev server.
- `JWT_EXP_HOURS` (default `12`) — how long a login token stays valid.

`.env` is git-ignored and must never be committed.

### 2c. Create the database

**macOS / Linux**

```bash
createdb ltride_dev
```

**Windows (PowerShell)**

```powershell
createdb ltride_dev
```

### 2d. Create the tables and load seed data

**macOS / Linux**

```bash
psql -d ltride_dev -f webapp/sql/migrations/001_init.sql   # schema (drops + recreates)
psql -d ltride_dev -f webapp/sql/seed.sql                  # demo lots, spaces, students
```

**Windows (PowerShell)**

```powershell
psql -d ltride_dev -f webapp\sql\migrations\001_init.sql    # schema (drops + recreates)
psql -d ltride_dev -f webapp\sql\seed.sql                   # demo lots, spaces, students
```

The seed includes a **dev-only** admin (`admin` / `admin123`) and four student
login codes (`STU001`–`STU004`). For anything beyond local demos, create your
own admin (next section) and do not rely on the seeded credentials.

---

## 3. Add an admin user

Use the helper script — it hashes the password (werkzeug scrypt) and writes the
`users` row that `POST /api/auth/admin` checks against. This is a bash script; on
Windows run it from **Git Bash** or **WSL** (see the Windows note at the top).

```bash
./webapp/bin/add-admin --username admin --name "Site Admin" --email admin@lt.edu
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
./webapp/bin/add-admin --username admin --force
```

Target a different database for one command:

**macOS / Linux**

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ltride_prod" ./webapp/bin/add-admin --username admin
```

**Windows (Git Bash)** — same as above. **Windows (WSL/bash)** also works. If you
prefer to set the variable from PowerShell before dropping into Git Bash:

```powershell
$env:DATABASE_URL = "postgresql://user:pass@host:5432/ltride_prod"
# then run: bash ./webapp/bin/add-admin --username admin
```

The script writes to the DB directly — the server does not need to be running.

---

## 4. Start / stop the server

Use the dev-server script (`webapp/bin/server`). This is a bash script; on Windows
run it from **Git Bash** or **WSL**.

```bash
./webapp/bin/server start      # launch on http://127.0.0.1:8000
./webapp/bin/server status     # is it running?
./webapp/bin/server stop       # stop it
./webapp/bin/server restart    # stop then start
```

Override host/port with env vars:

**macOS / Linux (and Git Bash)**

```bash
LTRIDE_PORT=9000 ./webapp/bin/server start
```

**Windows (PowerShell, then Git Bash)**

```powershell
$env:LTRIDE_PORT = 9000
# then run: bash ./webapp/bin/server start
```

Runtime files land in `webapp/var/` (pid + log, both git-ignored). Tail the log:

**macOS / Linux**

```bash
tail -f webapp/var/dev-server.log
```

**Windows (PowerShell)**

```powershell
Get-Content webapp\var\dev-server.log -Wait -Tail 20
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

**macOS / Linux**

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}'
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/auth/student `
  -ContentType application/json -Body '{"code":"STU001"}'
```

---

## 6. Run the smoke test (optional)

End-to-end check of every endpoint against a running server. It mutates data,
so re-migrate + re-seed afterward if you want a clean DB. Start the server from
Git Bash / WSL on Windows (see §4).

**macOS / Linux**

```bash
./webapp/bin/server start
.venv/bin/python webapp/tests/smoke_api.py http://127.0.0.1:8000
# ... == 67 passed, 0 failed ==

# restore a clean database
psql -d ltride_dev -f webapp/sql/migrations/001_init.sql
psql -d ltride_dev -f webapp/sql/seed.sql
```

**Windows (PowerShell)** — start the server from Git Bash first, then:

```powershell
.venv\Scripts\python webapp\tests\smoke_api.py http://127.0.0.1:8000
# ... == 67 passed, 0 failed ==

# restore a clean database
psql -d ltride_dev -f webapp\sql\migrations\001_init.sql
psql -d ltride_dev -f webapp\sql\seed.sql
```

---

## 7. Connect the React frontend (optional)

The SPA lives in the sibling repo `~/workspace/lt-parking-site-project`. Its dev
server runs on port `5173`, which matches the backend's default `CORS_ORIGINS`.

**macOS / Linux**

```bash
cd ~/workspace/lt-parking-site-project
npm install
npm run dev        # http://localhost:5173
```

**Windows (PowerShell)**

```powershell
cd $HOME\workspace\lt-parking-site-project
npm install
npm run dev        # http://localhost:5173
```

Point the frontend at the backend (`http://127.0.0.1:8000`) via its own env/config,
then log in with the admin or a student code.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `KeyError: 'SECRET_KEY'` on startup | `.env` missing or `SECRET_KEY`/`DATABASE_URL` unset — see §2b. |
| `Address already in use` on start | A previous server is still up. Run `./webapp/bin/server stop` (its fallback frees the port), then start again. |
| `add_admin.py: ... .venv/bin/python not found` (or `.venv\Scripts\python` on Windows) | Virtualenv not created — see §2a. |
| `psql: connection ... failed` | PostgreSQL not running. macOS: `brew services start postgresql@16`. Windows: `net start postgresql-x64-16` (or start it from `services.msc`). |
| `'./webapp/bin/server' is not recognized` / `add-admin` won't run on Windows | These are bash scripts — run them from Git Bash or WSL, not PowerShell/`cmd` (see the Windows note at the top). |
| `psql` / `createdb` not found on Windows | Add `C:\Program Files\PostgreSQL\16\bin` to your `PATH`. |
| `DATABASE_URL not set; using dev default` from `add-admin` | No `.env`/env var; it fell back to `postgresql:///ltride_dev`. Set `DATABASE_URL` to be explicit. |
| Login always 401 | Admin not created, or wrong password — recreate with `add-admin --force`. |