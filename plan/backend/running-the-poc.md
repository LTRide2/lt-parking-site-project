# Running the LTRide PoC (backend)

A step-by-step runbook to bring the backend up on a fresh machine, create the
initial admin, and verify it works. Paths are relative to the repo root
(`LTR-Backend/`). Commands assume macOS with Homebrew.

---

## 1. Prerequisites

- **Python 3.14** (the repo `.venv` is built on it).
- **PostgreSQL 16** running locally (`brew install postgresql@16 && brew services start postgresql@16`).
- **Node 18+** — only if you also want to run the React frontend.

Check they are available:

```bash
python3 --version         # 3.14.x
psql --version            # PostgreSQL 16.x
pg_isready                # accepting connections
```

---

## 2. One-time setup

### 2a. Python virtualenv + dependencies

The project uses the repo-root `.venv`. Create it and install the deps:

```bash
python3 -m venv .venv
.venv/bin/pip install -r webapp/requirements.txt
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

Two more settings are optional — add them only to override their defaults:

- `CORS_ORIGINS` (default `http://localhost:5173`) — web origins allowed to call
  the API; the default matches the React dev server.
- `JWT_EXP_HOURS` (default `12`) — how long a login token stays valid.

`.env` is git-ignored and must never be committed.

### 2c. Create the database

```bash
createdb ltride_dev
```

### 2d. Create the tables and load seed data

```bash
psql -d ltride_dev -f webapp/sql/migrations/001_init.sql   # schema (drops + recreates)
psql -d ltride_dev -f webapp/sql/seed.sql                  # demo lots, spaces, students
```

The seed includes a **dev-only** admin (`admin` / `admin123`) and four student
login codes (`STU001`–`STU004`). For anything beyond local demos, create your
own admin (next section) and do not rely on the seeded credentials.

---

## 3. Add an admin user

Use the helper script — it hashes the password (werkzeug scrypt) and writes the
`users` row that `POST /api/auth/admin` checks against.

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

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ltride_prod" ./webapp/bin/add-admin --username admin
```

The script writes to the DB directly — the server does not need to be running.

---

## 4. Start / stop the server

Use the dev-server script (`webapp/bin/server`):

```bash
./webapp/bin/server start      # launch on http://127.0.0.1:8000
./webapp/bin/server status     # is it running?
./webapp/bin/server stop       # stop it
./webapp/bin/server restart    # stop then start
```

Override host/port with env vars:

```bash
LTRIDE_PORT=9000 ./webapp/bin/server start
```

Runtime files land in `webapp/var/` (pid + log, both git-ignored). Tail the log:

```bash
tail -f webapp/var/dev-server.log
```

---

## 5. Verify it works

Health check:

```bash
curl -s http://127.0.0.1:8000/api/health
# {"data":{"status":"ok","time":"..."}}
```

Admin login (returns a JWT):

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/admin \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
# {"data":{"token":"...","user":{"id":...,"role":"admin",...}}}
```

Student login (seeded code):

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}'
```

---

## 6. Run the smoke test (optional)

End-to-end check of every endpoint against a running server. It mutates data,
so re-migrate + re-seed afterward if you want a clean DB.

```bash
./webapp/bin/server start
.venv/bin/python webapp/tests/smoke_api.py http://127.0.0.1:8000
# ... == 67 passed, 0 failed ==

# restore a clean database
psql -d ltride_dev -f webapp/sql/migrations/001_init.sql
psql -d ltride_dev -f webapp/sql/seed.sql
```

---

## 7. Connect the React frontend (optional)

The SPA lives in the sibling repo `~/workspace/lt-parking-site-project`. Its dev
server runs on port `5173`, which matches the backend's default `CORS_ORIGINS`.

```bash
cd ~/workspace/lt-parking-site-project
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
| `add_admin.py: ... .venv/bin/python not found` | Virtualenv not created — see §2a. |
| `psql: connection ... failed` | PostgreSQL not running — `brew services start postgresql@16`. |
| `DATABASE_URL not set; using dev default` from `add-admin` | No `.env`/env var; it fell back to `postgresql:///ltride_dev`. Set `DATABASE_URL` to be explicit. |
| Login always 401 | Admin not created, or wrong password — recreate with `add-admin --force`. |
