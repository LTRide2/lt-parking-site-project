# LTRide — Backend Development Guide

> **Who this is for:** someone brand new to coding. Follow it **literally, line by line**. Gray boxes are commands you type into the **Terminal**. Type one line, press Enter, wait, then the next.
>
> **What you are building:** the "backend" — a program (written in Python with a framework called **Flask**) that runs on a server, stores data in a **database**, and answers requests from the website over the internet as **JSON**. The website (frontend) has its own guide: [`../ui/ui-development-guide.md`](../ui/ui-development-guide.md). Read the [overall plan](../plan.md) first.
>
> **Where this doc sits:** this is the **backend design + implementation guide**, one of the docs in `plan/` — see the [document map in plan.md §0](../plan.md#0-start-here--which-document-do-i-read). `../plan.md` is the master/orchestrator; the sibling frontend guide is `../ui/ui-development-guide.md`; **deployment now has its own guide** at [`../deploy/deployment-guide.md`](../deploy/deployment-guide.md).
>
> **This guide builds the backend on your own computer (CRs B0–B7), one small CR at a time.** When it's working locally and you're ready to put it on AWS, switch to the [Deployment Guide](../deploy/deployment-guide.md) (CRs D0–D4).

---

## The source structure you're building toward

Before you touch anything, here's the map. **The left side is what's in the repo today; the right side is where you're heading.** Each CR moves a little of the left into the right.

### What exists today (a course-template scaffold)

```
LTR-Backend/                 # the repo root (you run most commands here)
├── webapp/                  # the real app lives here
│   ├── App/
│   │   ├── __init__.py      # Flask app factory (create_app)
│   │   ├── config.py        # settings (currently a hard-coded secret — B0 fixes this)
│   │   ├── model.py         # DB connection (currently SQLite)
│   │   └── views/           # the route handlers (endpoints)
│   │       ├── index.py     # placeholder routes from the template
│   │       ├── root.py
│   │       └── images.py
│   ├── sql/                 # database SQL files
│   └── requirements.txt     # the Python libraries to install (§0.5)
├── BK/                      # an OLDER duplicate of the app — ignore it
├── deploy/                  # AWS deployment artifacts (docs: ../deploy/deployment-guide.md)
│   ├── deploy.sh            # creates the AWS infrastructure
│   ├── release.sh           # ships your code to the server
│   ├── params/prod.json     # your AWS settings
│   ├── server/              # nginx + systemd + provision.sh (CR D1b)
│   └── cfn/                 # 01-network / 02-database / 03-compute / 04-dns (CR D1)
├── plan/                    # the design docs (master + one per component)
│   ├── plan.md              #   the master/orchestrator design doc
│   ├── backend/backend-development-guide.md   # this guide
│   ├── ui/ui-development-guide.md              # the frontend guide
│   └── deploy/deployment-guide.md             # the deployment guide (D0–D4 + reference)
└── webapp/var/ , *.pem      # local data & a key file — leave the .pem alone
```

> **Why two app copies (`webapp/` and `BK/`)?** The project was started from a course template that got duplicated. We build inside **`webapp/`** and ignore `BK/`. (A later cleanup can delete `BK/`, but that's not your job right now.)

### What it becomes as you finish the CRs (the target)

This is the same `webapp/App/` folder, filled in. Each file maps to a CR so you always know *where* new code goes:

```
webapp/
├── App/
│   ├── __init__.py          # registers all the blueprints below + CORS + error handling
│   ├── config.py            # reads SECRET_KEY, DATABASE_URL, CORS_ORIGINS from .env   (B0)
│   ├── db.py                # connects to PostgreSQL, returns rows as dicts            (B3)
│   ├── auth.py              # makes/checks login tokens (JWT), @require_role decorator (B3)
│   └── views/               # one file per feature area — these are the "endpoints"
│       ├── health.py        # GET /api/health                                          (B1)
│       ├── auth.py          # POST /api/auth/student | /admin , GET /api/auth/me        (B3)
│       ├── lots.py          # GET /api/lots , GET /api/lots/<id>/spaces                 (B4)
│       │                    # + PUT /api/lots/<id>/layout (B8) , POST /api/lots (B9)
│       ├── spaces.py        # PATCH /api/spaces , PATCH /api/spaces/<id>                (B5)
│       ├── interest.py      # POST/GET /api/interest , GET /api/interest/me             (B6)
│       └── assignments.py   # POST /api/assignments , DELETE /api/assignments/<id>      (B7)
├── sql/
│   ├── migrations/
│   │   └── 001_init.sql     # all tables incl. spaces.pos_x/pos_y/rotation (B2; used by B8)
│   └── seed.sql             # sample lots, spaces, an admin, a few students            (B2)
├── .env                     # your local secrets — never committed                     (B0)
├── .env.example             # a template of .env — safe to commit                      (B0)
└── requirements.txt         # the Python libraries
```

> **How to read this:** a **"view" / "blueprint"** is just a Python file holding a group of related endpoints. When the guide says *"add `views/auth.py`"*, you're adding one of these files and then telling `__init__.py` about it. The full per-endpoint request/response spec for every route lives in [**Appendix A — Backend API Reference**](#appendix-a--backend-api-reference-v1) at the end of this guide (moved here from `plan.md §7`).

---

## Part 0 — One-time setup

### 0.1 Install the tools

1. **VS Code** — <https://code.visualstudio.com> (same editor as the frontend).
2. **Python 3.11+** — macOS may already have it. Check:
   ```bash
   python3 --version
   ```
   If it's missing or older than 3.11, install with Homebrew (see 0.2) via `brew install python@3.12`.
3. **Homebrew** (the macOS app installer we'll reuse for everything) — if `brew --version` fails, install it from <https://brew.sh> (paste their one-line command).
4. **Git** — check `git --version` (same as the frontend guide).
5. **PostgreSQL** — the database itself *and* its command-line tools (`psql`, `createdb`). Install it now; you'll **start it and put it on your PATH** in CR B2 (there's a full step-by-step box there):
   ```bash
   brew install postgresql@16
   ```
   > `psql` is the terminal program for talking to the database; `createdb` makes a new database. They arrive with this install but need two extra one-time steps (start the server + add to PATH) — all covered in the **"Installing and starting PostgreSQL"** box in CR B2.

### 0.2 Tell Git who you are (skip if you already did this for the frontend)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 0.3 Get the backend project

```bash
cd ~/workspace
cd LTR-Backend
ls
```
You should see folders like `webapp/`, `plan/`, `deploy/`.

### 0.4 Make a "virtual environment" (Python's private toolbox)

A **virtual environment** (venv) is a private folder of Python libraries just for this project, so it never clashes with the rest of your computer.

```bash
python3 -m venv .venv
source .venv/bin/activate
```
After the second line your prompt shows `(.venv)` at the start. That means it's active. **You must run `source .venv/bin/activate` every time you open a new terminal** to work on the backend.

To turn it off later: type `deactivate`.

### 0.5 Install the backend's libraries

The list of libraries lives in **`webapp/requirements.txt`** (not the repo root — there's also an older copy in `BK/`, ignore that one). From the repo root (`~/workspace/LTR-Backend`), with the venv active, run:

```bash
pip install -r webapp/requirements.txt
```

> **Tip:** if you'd rather not type the `webapp/` path each time, you can `cd webapp` first and then run `pip install -r requirements.txt`. Just remember which folder you're in — `pwd` tells you.

---

## Part 1 — Build the backend, CR by CR

> **The same Git routine as the frontend** (see [`../ui/ui-development-guide.md`](../ui/ui-development-guide.md) Part B/C). Each backend CR is `cr/b<N>-<slug>` and **branches off the previous backend CR**. Every PR uses the CR description template and includes a local testing guide. The full stacked-CR strategy and the live [CR status tracker](../plan.md#82-cr-status-tracker) are in [`../plan.md §8`](../plan.md#8-implementation-strategy-stacked-crs).
>
> **How you'll test the backend without a browser:** with a tool called `curl` (sends a request from the terminal) and your terminal output. Each CR below gives you the exact `curl` command and what you should see back.

### Vocabulary

- **Endpoint / route** — a URL the backend answers, like `GET /api/lots`. "GET" / "POST" / "PATCH" / "DELETE" are the *method* (read / create / update / delete).
- **JSON** — the text format data travels in: `{"name": "Lot 1"}`.
- **Database** — where data is permanently stored, in tables (like spreadsheets).
- **Migration** — a `.sql` file that creates or changes database tables. We number them so they run in order.
- **Environment variable** — a setting read from outside the code (like a password) so secrets aren't written in the code.

---

### The "☁️ Cloud check" recipe (deploy a CR and test it on the real server)

Each CR below ends with two test passes:
- **Local testing guide** — test on your laptop (always do this first; it's fast and free).
- **☁️ Cloud check** — *optionally* push the same CR to the real AWS server and confirm it works there too. This catches "works on my machine" problems (missing env var, migration not applied, CORS) early instead of all at once at the end.

**One-time prerequisite (do this once, before your first cloud check).** The AWS server has to exist before you can deploy to it. That setup lives in **Part 2** — jump ahead and do **D0** (AWS account + CLI), **D1** (templates), and **D2** (`./deploy.sh up`) one time. It takes ~15 min and ~a few dollars/month while it's running (or `./deploy.sh down` between sessions). Come back here once `./deploy.sh outputs` prints a public IP.

**The repeatable recipe — run this after committing any CR you want to verify in the cloud:**
```bash
# 1) make sure your CR is committed and pushed (release.sh pulls from git on the server)
git push

# 2) ship it to the server (builds nothing for backend-only; migrates DB; restarts gunicorn)
cd ~/workspace/LTR-Backend/deploy
./release.sh backend          # use ./release.sh all once the frontend is also ready

# 3) find your server address
./deploy.sh outputs           # note the ElasticIp / PublicIp
```
Then run that CR's **☁️ Cloud check** line below, swapping `http://localhost:8000` for `http://<ElasticIp>`. That's the only difference from local testing — same endpoints, real server.

> **Tip:** if a cloud check fails but the local test passed, it's almost always (a) a migration that didn't run on the server, (b) a missing env var in the server's `.env`, or (c) CORS. See **Part 3 — Operating & troubleshooting**.

---

### CR B0 — Clean slate & safety (do this first)

**Goal:** make the project safe and tidy before building features. (This is the deferred security cleanup — **do not touch the `aws-tutorial.pem` key**; that one is being handled separately.)

**Branch:**
```bash
git checkout main
git pull
git checkout -b cr/b0-hygiene
```

**Steps:**

1. **Stop committing secrets and junk.** Create (or open) the file `.gitignore` at the repo root and make sure it contains **exactly** these lines (add any that are missing — order doesn't matter):
   ```gitignore
   # Python
   .venv/
   env/
   __pycache__/
   *.pyc

   # local database files (if you ever use SQLite)
   *.sqlite3

   # secrets & local settings — NEVER commit these
   .env

   # the AWS key file (handled separately — do not touch the key itself)
   *.pem

   # build output / dependencies
   node_modules/
   dist/
   ```

2. **Add the libraries this project needs.** Open `webapp/requirements.txt` and make sure these lines are present (add the missing ones). We'll use them across the next CRs:
   ```text
   Flask>=2.2
   flask-cors>=4.0
   psycopg[binary]>=3.1
   PyJWT>=2.8
   python-dotenv>=1.0
   Werkzeug>=2.2
   gunicorn>=21.2
   ```
   Then install them (venv active):
   ```bash
   pip install -r webapp/requirements.txt
   ```

3. **Move the secret key out of the code.** Open `webapp/App/config.py`. Find the hard-coded line that looks like `SECRET_KEY = "some-literal-string"` and replace the whole file's settings with this env-driven version:
   ```python
   # webapp/App/config.py
   """All settings come from environment variables (loaded from .env locally)."""
   import os

   # Loads variables from a local .env file if present. On the real server the
   # variables are set by systemd, so this is a no-op there.
   from dotenv import load_dotenv
   load_dotenv()

   # Required — the app refuses to start if these are missing.
   SECRET_KEY = os.environ["SECRET_KEY"]
   DATABASE_URL = os.environ["DATABASE_URL"]

   # Optional — sensible defaults for local development.
   CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
   JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", "12"))
   ```
   > **Why `os.environ[...]` (square brackets) and not `.get(...)`?** Square brackets make the app crash immediately with a clear error if a required secret is missing — far better than starting up "half-configured" and failing mysteriously later.

4. **Create a `.env` file** at the repo root (it's git-ignored, so it stays on your machine only). This holds your *local* secrets:
   ```dotenv
   SECRET_KEY=dev-only-change-me-to-anything-long-and-random
   DATABASE_URL=postgresql://localhost/ltride_dev
   CORS_ORIGINS=http://localhost:5173
   JWT_EXP_HOURS=12
   ```

5. **Create `.env.example`** at the repo root — same keys, but **no real secrets**. This one *is* committed so the next person knows what to fill in:
   ```dotenv
   SECRET_KEY=
   DATABASE_URL=postgresql://localhost/ltride_dev
   CORS_ORIGINS=http://localhost:5173
   JWT_EXP_HOURS=12
   ```

**Local testing guide:**
1. Setup: `source .venv/bin/activate`; create the `.env` file from step 4.
2. Steps:
   ```bash
   git status                                  # what would be committed?
   python -c "import webapp.App.config as c; print('SECRET loaded:', bool(c.SECRET_KEY))"
   ```
3. Expected:
   - `git status` does **not** list `.venv/`, `__pycache__`, `.env`, or any `*.pem` file.
   - The `python -c ...` line prints `SECRET loaded: True` (proves the secret comes from `.env`, not the code).
   - If you temporarily rename `.env`, that same command crashes with `KeyError: 'SECRET_KEY'` — that's the intended "fail loud" behavior.

**Commit & push:**
```bash
git add -A
git commit -m "B0: gitignore junk, move SECRET_KEY/DATABASE_URL to env, add .env.example"
git push -u origin cr/b0-hygiene
```
PR base = `main`.

---

### CR B1 — Health check (prove the server runs)

**Depends on:** B0. **Branch off B0.**

**Goal:** one tiny endpoint, `GET /api/health`, that returns `{"data":{"status":"ok"}}`. This proves the whole setup works before adding anything complex.

**Branch:**
```bash
git checkout cr/b0-hygiene
git checkout -b cr/b1-health
```

**Steps:**

1. **Create the health route.** In `webapp/App/views/`, create a new file `health.py`:
   ```python
   # webapp/App/views/health.py
   from datetime import datetime, timezone
   from flask import Blueprint, jsonify

   # A "Blueprint" is a group of related routes. We register it in __init__.py.
   bp = Blueprint("health", __name__)

   @bp.get("/api/health")
   def health():
       now = datetime.now(timezone.utc).isoformat()
       return jsonify({"data": {"status": "ok", "time": now}})
   ```

2. **Write the app factory.** Open `webapp/App/__init__.py` and replace its contents with this. `create_app()` is the standard Flask pattern: one function that builds and returns the app.
   ```python
   # webapp/App/__init__.py
   from flask import Flask, jsonify
   from flask_cors import CORS

   from . import config


   def create_app():
       app = Flask(__name__)
       app.config["SECRET_KEY"] = config.SECRET_KEY

       # Allow the React dev server (and later the real site) to call this API.
       CORS(app, origins=config.CORS_ORIGINS.split(","), supports_credentials=True)

       # Register every blueprint (group of routes). We add more in later CRs.
       from .views import health
       app.register_blueprint(health.bp)

       # Turn any uncaught error into our standard JSON error envelope so the
       # frontend always gets predictable shapes.
       @app.errorhandler(404)
       def not_found(_e):
           return jsonify({"error": {"code": "not_found", "message": "Not found"}}), 404

       @app.errorhandler(500)
       def server_error(_e):
           return jsonify({"error": {"code": "server_error", "message": "Server error"}}), 500

       return app


   # Lets `flask run` find the app via FLASK_APP=webapp.App
   app = create_app()
   ```

**Run the server (do this in its own terminal, venv active, from the repo root):**
```bash
export FLASK_APP=webapp.App
flask run --port 8000
```
> If you get `ModuleNotFoundError: webapp`, you're in the wrong folder — run it from `~/workspace/LTR-Backend` (where the `webapp/` folder is visible with `ls`).

**Local testing guide:**
1. Setup: venv active; `.env` exists (from B0); `flask run --port 8000` in one terminal.
2. Steps: in a **second** terminal:
   ```bash
   curl -i http://localhost:8000/api/health
   curl -i http://localhost:8000/api/does-not-exist
   ```
3. Expected:
   - The first returns `200` and `{"data":{"status":"ok","time":"...."}}`.
   - The second returns `404` and `{"error":{"code":"not_found","message":"Not found"}}` — proving the error envelope works.

**☁️ Cloud check (optional):** run the recipe (`git push` → `./release.sh backend` → `./deploy.sh outputs`), then:
```bash
curl -i http://<ElasticIp>/api/health     # expect 200 {"data":{"status":"ok",...}}
```
This is the best first cloud check — if `/api/health` works on the server, your whole deploy pipeline (git pull → gunicorn → nginx) is healthy.

---

### CR B2 — Database schema & seed data

**Depends on:** B1. **Branch off B1.**

**Goal:** create the real tables and put a little test data in so later CRs have something to read.

**Branch:**
```bash
git checkout cr/b1-health
git checkout -b cr/b2-schema
```

#### The database diagram (what you're building)

These are the five tables and how they connect. An arrow `A → B` means "a row in A points at a row in B" (a *foreign key*).

```mermaid
erDiagram
    users {
        int           id PK
        text          role          "student | admin"
        text          code          "student login code, NULL for admins"
        text          username      "admin login, NULL for students"
        text          password_hash "admin password hash, NULL for students"
        text          name
        text          email
        timestamptz   created_at
    }
    lots {
        int   id PK
        text  name
        int   display_order
        text  map_image_url
    }
    spaces {
        int   id PK
        int   lot_id FK
        text  label
        text  status            "available | disabled | assigned"
        int   assigned_user_id FK "NULL unless assigned"
    }
    interest {
        int          id PK
        int          user_id FK
        int          lot_id FK     "preferred lot, may be NULL"
        text         status        "pending | fulfilled | declined"
        timestamptz  created_at
    }
    assignments {
        int          id PK
        int          space_id FK
        int          user_id FK
        int          assigned_by FK "the admin who did it"
        boolean      active
        timestamptz  created_at
    }

    lots     ||--o{ spaces      : "contains"
    lots     ||--o{ interest    : "preferred in"
    users    ||--o{ interest    : "registers"
    users    ||--o{ assignments : "receives"
    users    ||--o{ assignments : "assigned_by (admin)"
    spaces   ||--o{ assignments : "is for"
    users    |o--o{ spaces      : "currently assigned to"
```

**The three fixed value sets (enums):**
- `users.role` ∈ `{student, admin}`
- `spaces.status` ∈ `{available, disabled, assigned}`
- `interest.status` ∈ `{pending, fulfilled, declined}`

#### Step 1 — Create the database (one time)

```bash
createdb ltride_dev
```
> If `createdb` says "command not found", Postgres isn't on your PATH yet — see the **"Installing and starting PostgreSQL"** box at the end of this CR, do that, then come back.

#### Step 2 — Write the schema file

Create the folder and file `webapp/sql/migrations/001_init.sql` with **exactly** this content. Read the comments — they explain each choice.

```sql
-- webapp/sql/migrations/001_init.sql
-- Initial schema for LTRide. Safe to re-run: it drops then recreates everything.

BEGIN;

DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS interest    CASCADE;
DROP TABLE IF EXISTS spaces      CASCADE;
DROP TABLE IF EXISTS lots        CASCADE;
DROP TABLE IF EXISTS users       CASCADE;

-- USERS: both students and admins live here, told apart by `role`.
--   students  -> have a `code`, no username/password
--   admins    -> have username + password_hash, no code
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    role          TEXT NOT NULL CHECK (role IN ('student', 'admin')),
    code          TEXT UNIQUE,                 -- student login code (e.g. STU001)
    username      TEXT UNIQUE,                 -- admin login name
    password_hash TEXT,                        -- admin password (hashed, never plain)
    name          TEXT NOT NULL,
    email         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LOTS: a parking lot / area.
CREATE TABLE lots (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    map_image_url TEXT
);

-- SPACES: one parking space, belongs to a lot.
--   pos_x / pos_y / rotation are where the space sits on the lot's map image.
--   They are NORMALIZED fractions (0..1 of the image), not pixels, so the layout
--   survives zoom/resize on any screen. NULL = "no authored position yet" (the UI
--   falls back to its config-table layout). An admin sets them with the drag-and-drop
--   editor via PUT /api/lots/:id/layout (built in B8) — the column is here from day one.
CREATE TABLE spaces (
    id               SERIAL PRIMARY KEY,
    lot_id           INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    label            TEXT NOT NULL,            -- human label, e.g. "1-0-3"
    status           TEXT NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available', 'disabled', 'assigned')),
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    pos_x            DOUBLE PRECISION CHECK (pos_x IS NULL OR (pos_x >= 0 AND pos_x <= 1)),
    pos_y            DOUBLE PRECISION CHECK (pos_y IS NULL OR (pos_y >= 0 AND pos_y <= 1)),
    rotation         DOUBLE PRECISION,         -- degrees; NULL treated as 0
    UNIQUE (lot_id, label)                     -- no two spaces share a label in a lot
);

-- INTEREST: a student registering that they want a spot.
CREATE TABLE interest (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lot_id     INTEGER REFERENCES lots(id) ON DELETE SET NULL,  -- preferred lot (optional)
    status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'fulfilled', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stop a student having two *active* (pending) requests at once.
-- (Used by B6's "duplicate request -> 409" rule.)
CREATE UNIQUE INDEX one_active_interest_per_user
    ON interest (user_id)
    WHERE status = 'pending';

-- ASSIGNMENTS: an admin gave a space to a student. History is kept (active flag).
CREATE TABLE assignments (
    id          SERIAL PRIMARY KEY,
    space_id    INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES users(id),   -- the admin
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A space can have at most ONE active assignment at a time.
CREATE UNIQUE INDEX one_active_assignment_per_space
    ON assignments (space_id)
    WHERE active;

COMMIT;
```

> **Why the partial unique indexes?** They let the *database itself* enforce the rules ("one pending request per student", "one active assignment per space") so you can't get into a bad state even if there's a bug in the Python code. The `WHERE` clause means the rule only applies to the rows that matter (e.g. only `pending` interest).

> **Why `pos_x/pos_y/rotation` are here from the start.** These columns aren't used until [CR B8](#cr-b8--save-lot-layout-spot-positions) (the drag-and-drop layout editor, frontend [U8](../ui/ui-development-guide.md#cr-u8--place--arrange-parking-spots-drag-and-drop-layout-editor)) — but this is a fresh schema that hasn't shipped anywhere, so we **design them in now** rather than bolt them on with a later migration. A column can exist before the feature that fills it; that's normal, and it keeps the data model honest (spot placement is a real property of a space, per plan.md §5.1). Migrations earn their keep once `001_init.sql` has actually run on a live database — from that point on you add new migration files instead of editing this one.

#### Step 3 — Make the admin password hash

We never store a plain password. Generate a hash for the admin's password (`admin123` for local dev) using the same library the app will use to check it:

```bash
python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('admin123'))"
```
This prints a long string starting with `scrypt:` or `pbkdf2:`. **Copy that whole string** — you'll paste it into the seed file in the next step.

#### Step 4 — Write the seed file

Create `webapp/sql/seed.sql`. Replace `PASTE_HASH_HERE` with the string you just copied.

```sql
-- webapp/sql/seed.sql
-- Sample data for local development. Re-runnable (clears the tables first).

BEGIN;

TRUNCATE assignments, interest, spaces, lots, users RESTART IDENTITY CASCADE;

-- One admin. password is 'admin123' (only for local dev!).
INSERT INTO users (role, username, password_hash, name, email) VALUES
    ('admin', 'admin', 'PASTE_HASH_HERE', 'Site Admin', 'admin@school.edu');

-- A few students. They log in with their code (no password).
INSERT INTO users (role, code, name, email) VALUES
    ('student', 'STU001', 'Jane Doe',   'jane@school.edu'),
    ('student', 'STU002', 'John Smith', 'john@school.edu'),
    ('student', 'STU003', 'Amy Lee',    'amy@school.edu');

-- Two lots.
INSERT INTO lots (name, display_order) VALUES
    ('Lot 1', 1),
    ('Lot 2', 2);

-- ~20 spaces in Lot 1 (ids/labels 1-0-1 .. 1-0-20), all available to start.
INSERT INTO spaces (lot_id, label, status)
SELECT 1, '1-0-' || g, 'available'
FROM generate_series(1, 20) AS g;

-- A handful in Lot 2 so the lot switcher has something to show.
INSERT INTO spaces (lot_id, label, status)
SELECT 2, '2-0-' || g, 'available'
FROM generate_series(1, 6) AS g;

COMMIT;
```

> **`generate_series(1, 20)`** is a Postgres trick that produces the numbers 1..20, so we insert 20 spaces without writing 20 lines. `'1-0-' || g` glues the text label together (`||` is "join strings" in SQL).

#### Step 5 — Run them

```bash
psql ltride_dev -f webapp/sql/migrations/001_init.sql
psql ltride_dev -f webapp/sql/seed.sql
```
Each should print a list of `CREATE TABLE` / `INSERT` lines and no `ERROR`.

**Local testing guide:**
1. Setup: Postgres running (`brew services start postgresql@16`); both files run with no error.
2. Steps:
   ```bash
   psql ltride_dev -c "\dt"                                          # list tables
   psql ltride_dev -c "SELECT label, status FROM spaces WHERE lot_id=1 LIMIT 5;"
   psql ltride_dev -c "SELECT code, name FROM users WHERE role='student';"
   psql ltride_dev -c "SELECT count(*) AS lot1_spaces FROM spaces WHERE lot_id=1;"
   ```
3. Expected:
   - `\dt` lists all five tables: `assignments, interest, lots, spaces, users`.
   - The spaces query shows labels like `1-0-1 … 1-0-5`, all `available`.
   - The users query shows `STU001 Jane Doe`, `STU002 John Smith`, `STU003 Amy Lee`.
   - `lot1_spaces` = `20`.

**☁️ Cloud check (optional):** the schema/seed run against the **server's** database (RDS), not your laptop's. `release.sh` auto-applies `sql/migrations/*.sql` on deploy, but the **seed** is manual (you don't want dev data on a real site). To verify on the server:
```bash
./release.sh backend                       # applies 001_init.sql on RDS
ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp>
sudo -u ltride bash -c 'set -a; . /home/ltride/app/.env; set +a; psql "$DATABASE_URL" -c "\dt"'
# expect the five tables. To seed dev data on the server too (optional):
#   psql "$DATABASE_URL" -f /home/ltride/app/sql/seed.sql
exit
```
Expect `\dt` to list the same five tables on RDS.

**Commit & push:**
```bash
git add webapp/sql/
git commit -m "B2: add schema migration + dev seed data"
git push -u origin cr/b2-schema
```
> Double-check: the real admin hash is fine to commit here because it's a throwaway *local-dev* password. Never commit a hash of a real production password.

---

> #### 📦 Installing and starting PostgreSQL (do this once, if `createdb`/`psql` aren't found)
>
> `psql` and `createdb` are command-line tools that come **with PostgreSQL**. In §0.1 you ran `brew install postgresql@16`, which installs them — but two things often trip people up: the database **server isn't running yet**, and the tools **aren't on your PATH**. Fix both:
>
> 1. **Start the database server** (and have it auto-start on login):
>    ```bash
>    brew services start postgresql@16
>    ```
> 2. **Put the tools on your PATH.** Homebrew installs this version "keg-only", meaning you must add it yourself. Run the line for your Mac:
>    ```bash
>    # Apple Silicon (M1/M2/M3) Macs:
>    echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
>    # Intel Macs:
>    echo 'export PATH="/usr/local/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
>    ```
>    Then reload your shell: `source ~/.zshrc` (or just open a new Terminal window).
> 3. **Verify:**
>    ```bash
>    psql --version        # should print "psql (PostgreSQL) 16.x"
>    createdb --version
>    ```
> 4. The very first connection sometimes fails with *"role does not exist"*. If so, create a database user matching your Mac username once:
>    ```bash
>    createuser -s "$(whoami)"
>    ```
>
> **What is `psql`?** It's the interactive PostgreSQL client — a terminal program for talking to the database. `psql ltride_dev` opens a session connected to the `ltride_dev` database; `psql ltride_dev -f file.sql` runs a file against it; `psql ltride_dev -c "SQL..."` runs one command. Type `\q` to quit an interactive session.

---

### CR B3 — Authentication (login)

**Depends on:** B2. **Branch off B2.** **Unblocks frontend U1.**

**Goal:** the three auth endpoints so people can log in:
- `POST /api/auth/student` — body `{"code":"STU001"}` → returns a token + user.
- `POST /api/auth/admin` — body `{"username","password"}` → returns a token + user.
- `GET /api/auth/me` — returns the logged-in user (reads the `Authorization: Bearer <token>` header).

**Branch:**
```bash
git checkout cr/b2-schema
git checkout -b cr/b3-auth
```

#### Step 1 — Database helper (`webapp/App/db.py`)

This is the **one place** that opens a connection to PostgreSQL. Everything else asks it for a connection. Create `webapp/App/db.py`:
```python
# webapp/App/db.py
"""Database access: one connection per request, rows returned as dicts."""
import psycopg
from psycopg.rows import dict_row
from flask import g

from . import config


def get_db():
    """Return this request's DB connection, opening one if needed."""
    if "db" not in g:
        g.db = psycopg.connect(config.DATABASE_URL, row_factory=dict_row)
    return g.db


def close_db(_e=None):
    """Close the connection at the end of the request (wired in __init__.py)."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query(sql, params=()):
    """Run a SELECT, return a list of dict rows."""
    with get_db().cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def query_one(sql, params=()):
    """Run a SELECT, return the first dict row or None."""
    with get_db().cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute(sql, params=()):
    """Run an INSERT/UPDATE/DELETE and commit. Returns the first row if the
    SQL ends in RETURNING, else None."""
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone() if cur.description else None
    db.commit()
    return row
```
Then wire `close_db` into the app factory. In `webapp/App/__init__.py`, inside `create_app()`, add after `CORS(...)`:
```python
    from . import db
    app.teardown_appcontext(db.close_db)
```

#### Step 2 — Auth service (`webapp/App/auth.py`)

This creates and checks **tokens** (a JWT is a signed string that proves who you are) and provides the `@require_role` guard. Create `webapp/App/auth.py`:
```python
# webapp/App/auth.py
"""Token creation/verification and the route guards."""
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import request, jsonify, g

from . import config
from .db import query_one


def issue_token(user):
    """Make a signed token that says who this user is and when it expires."""
    payload = {
        "user_id": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXP_HOURS),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def _current_user():
    """Read the Bearer token, verify it, and load the user. None if invalid."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return query_one("SELECT id, role, name, email FROM users WHERE id = %s",
                     (payload["user_id"],))


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def require_auth(fn):
    """Allow any logged-in user. Stashes the user on flask.g."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _current_user()
        if user is None:
            return _error("unauthorized", "Login required", 401)
        g.user = user
        return fn(*args, **kwargs)
    return wrapper


def require_role(role):
    """Allow only a given role (e.g. 'admin')."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _current_user()
            if user is None:
                return _error("unauthorized", "Login required", 401)
            if user["role"] != role:
                return _error("forbidden", f"{role} only", 403)
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator
```

#### Step 3 — Auth routes (`webapp/App/views/auth.py`)

Create `webapp/App/views/auth.py`:
```python
# webapp/App/views/auth.py
from flask import Blueprint, request, jsonify, g
from werkzeug.security import check_password_hash

from ..db import query_one
from ..auth import issue_token, require_auth

bp = Blueprint("auth", __name__)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _public_user(u):
    return {"id": u["id"], "role": u["role"], "name": u["name"]}


@bp.post("/api/auth/student")
def student_login():
    body = request.get_json(silent=True) or {}
    code = body.get("code")
    if not code:
        return _err("bad_request", "code is required", 400)
    user = query_one(
        "SELECT id, role, name FROM users WHERE role='student' AND code = %s", (code,))
    if user is None:
        return _err("unauthorized", "Unknown code", 401)
    return jsonify({"data": {"token": issue_token(user), "user": _public_user(user)}})


@bp.post("/api/auth/admin")
def admin_login():
    body = request.get_json(silent=True) or {}
    username, password = body.get("username"), body.get("password")
    if not username or not password:
        return _err("bad_request", "username and password are required", 400)
    user = query_one(
        "SELECT id, role, name, password_hash FROM users "
        "WHERE role='admin' AND username = %s", (username,))
    if user is None or not check_password_hash(user["password_hash"], password):
        return _err("unauthorized", "Bad credentials", 401)
    return jsonify({"data": {"token": issue_token(user), "user": _public_user(user)}})


@bp.post("/api/auth/logout")
def logout():
    # Tokens are stateless, so the client just discards it. 204 = "done, no body".
    return "", 204


@bp.get("/api/auth/me")
@require_auth
def me():
    u = g.user
    return jsonify({"data": {"id": u["id"], "role": u["role"],
                             "name": u["name"], "email": u["email"]}})
```

#### Step 4 — Register the blueprint

In `webapp/App/__init__.py`, next to where you registered `health`, add:
```python
    from .views import auth
    app.register_blueprint(auth.bp)
```

**Local testing guide:**
1. Setup: DB seeded (B2); `flask run --port 8000` running.
2. Steps:
   ```bash
   # valid student
   curl -i -X POST http://localhost:8000/api/auth/student \
     -H 'Content-Type: application/json' -d '{"code":"STU001"}'
   # invalid student
   curl -i -X POST http://localhost:8000/api/auth/student \
     -H 'Content-Type: application/json' -d '{"code":"NOPE"}'
   # admin (password from B2 seed)
   curl -i -X POST http://localhost:8000/api/auth/admin \
     -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'
   ```
   Copy the `token` value from a successful response, then:
   ```bash
   curl -i http://localhost:8000/api/auth/me -H "Authorization: Bearer <paste-token>"
   curl -i http://localhost:8000/api/auth/me     # no token
   ```
3. Expected:
   - Valid student/admin → `200` with `{"data":{"token":"...","user":{...}}}`.
   - Wrong code / wrong password → `401` `{"error":{"code":"unauthorized",...}}`.
   - `/me` with token → `200` and your user; `/me` without token → `401`.

**☁️ Cloud check (optional):** after `./release.sh backend`, repeat the login against the server (the seed must have been run on RDS — see B2's cloud check):
```bash
curl -i -X POST http://<ElasticIp>/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}'
```
Expect `200` with a token. A `500` here usually means `SECRET_KEY`/`DATABASE_URL` aren't set in the server's `.env` (`Part 3`).

**Commit & push:**
```bash
git add -A
git commit -m "B3: db helper, JWT auth service, student/admin login + /me"
git push -u origin cr/b3-auth
```

---

### CR B4 — Read lots & spaces

**Depends on:** B3. **Branch off B3.** **Unblocks frontend U3.**

**Goal:**
- `GET /api/lots` → all lots (with capacity + available counts).
- `GET /api/lots/:id/spaces` → spaces in one lot.

**Branch:**
```bash
git checkout cr/b3-auth
git checkout -b cr/b4-lots
```

**Step 1 — Create `webapp/App/views/lots.py`:**
```python
# webapp/App/views/lots.py
from flask import Blueprint, jsonify

from ..db import query, query_one
from ..auth import require_auth

bp = Blueprint("lots", __name__)


@bp.get("/api/lots")
@require_auth
def list_lots():
    rows = query("""
        SELECT l.id, l.name, l.display_order, l.map_image_url,
               count(s.id)                                    AS capacity,
               count(s.id) FILTER (WHERE s.status='available') AS available_count
        FROM lots l
        LEFT JOIN spaces s ON s.lot_id = l.id
        GROUP BY l.id
        ORDER BY l.display_order, l.id
    """)
    data = [{
        "id": r["id"], "name": r["name"], "displayOrder": r["display_order"],
        "mapImageUrl": r["map_image_url"], "capacity": r["capacity"],
        "availableCount": r["available_count"],
    } for r in rows]
    return jsonify({"data": data})


@bp.get("/api/lots/<int:lot_id>/spaces")
@require_auth
def lot_spaces(lot_id):
    lot = query_one("SELECT id FROM lots WHERE id = %s", (lot_id,))
    if lot is None:
        return jsonify({"error": {"code": "not_found", "message": "Lot not found"}}), 404
    rows = query("""
        SELECT id, label, status, assigned_user_id
        FROM spaces WHERE lot_id = %s ORDER BY id
    """, (lot_id,))
    spaces = [{
        "id": r["id"], "label": r["label"], "status": r["status"],
        "assignedUserId": r["assigned_user_id"],
    } for r in rows]
    return jsonify({"data": {"lotId": lot_id, "spaces": spaces}})
```

**Step 2 — Register it** in `webapp/App/__init__.py`:
```python
    from .views import lots
    app.register_blueprint(lots.bp)
```

**Local testing guide:**
1. Setup: server running; a token from B3 (`export T=<token>` makes the commands shorter).
2. Steps:
   ```bash
   curl -i http://localhost:8000/api/lots -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots/999/spaces -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots          # no token
   ```
3. Expected:
   - `/api/lots` → `200` with Lot 1 (`capacity` 20, `availableCount` 20) and Lot 2.
   - `/api/lots/1/spaces` → `200` with 20 spaces, each `available`.
   - Lot `999` → `404`; no token → `401`.

**☁️ Cloud check (optional):** after `./release.sh backend`, with a token from the server's `/api/auth/student`:
```bash
curl -s http://<ElasticIp>/api/lots -H "Authorization: Bearer $T"
```
Expect the same lots JSON the local server returned (assuming RDS was seeded).

**Commit & push:**
```bash
git add -A && git commit -m "B4: read lots and spaces" && git push -u origin cr/b4-lots
```

---

### CR B5 — Admin enables/disables spaces

**Depends on:** B4. **Branch off B4.** **Unblocks frontend U4.**

**Goal:**
- `PATCH /api/spaces/:id` — change one space's status (`available` or `disabled`).
- `PATCH /api/spaces` — change many at once, body `{"ids":[...],"status":"disabled"}`.

Both require admin (`@require_role("admin")`). You **cannot** disable a space that is currently `assigned` — that returns `409` (single) or is reported in `skipped` (bulk).

**Branch:**
```bash
git checkout cr/b4-lots
git checkout -b cr/b5-spaces
```

**Step 1 — Create `webapp/App/views/spaces.py`:**
```python
# webapp/App/views/spaces.py
from flask import Blueprint, request, jsonify

from ..db import query_one, execute, get_db
from ..auth import require_role

bp = Blueprint("spaces", __name__)
ALLOWED = {"available", "disabled"}   # admins toggle these; 'assigned' is set by B7


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


@bp.patch("/api/spaces/<int:space_id>")
@require_role("admin")
def update_space(space_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in ALLOWED:
        return _err("bad_request", "status must be 'available' or 'disabled'", 400)

    space = query_one("SELECT id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if space["status"] == "assigned":
        return _err("conflict", "Space is assigned; unassign it first", 409)

    row = execute(
        "UPDATE spaces SET status = %s WHERE id = %s "
        "RETURNING id, label, status, assigned_user_id", (status, space_id))
    return jsonify({"data": {
        "id": row["id"], "label": row["label"], "status": row["status"],
        "assignedUserId": row["assigned_user_id"],
    }})


@bp.patch("/api/spaces")
@require_role("admin")
def bulk_update_spaces():
    body = request.get_json(silent=True) or {}
    ids, status = body.get("ids"), body.get("status")
    if not isinstance(ids, list) or not ids or status not in ALLOWED:
        return _err("bad_request", "ids (non-empty list) and valid status required", 400)

    updated, skipped = [], []
    db = get_db()
    with db.cursor() as cur:
        for sid in ids:
            cur.execute("SELECT id, status FROM spaces WHERE id = %s", (sid,))
            row = cur.fetchone()
            if row is None:
                skipped.append({"id": sid, "reason": "not_found"}); continue
            if row["status"] == "assigned":
                skipped.append({"id": sid, "reason": "assigned"}); continue
            cur.execute("UPDATE spaces SET status = %s WHERE id = %s", (status, sid))
            updated.append({"id": sid, "status": status})
    db.commit()
    return jsonify({"data": {"updated": updated, "skipped": skipped}})
```

**Step 2 — Register it** in `webapp/App/__init__.py`:
```python
    from .views import spaces
    app.register_blueprint(spaces.bp)
```

**Local testing guide:**
1. Setup: server running. Get an **admin** token (`export A=<admin-token>`) and a **student** token (`export S=<student-token>`).
2. Steps:
   ```bash
   # bulk disable spaces 1,2,3 as admin
   curl -i -X PATCH http://localhost:8000/api/spaces \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"ids":[1,2,3],"status":"disabled"}'
   # confirm it stuck
   curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"
   # single re-enable
   curl -i -X PATCH http://localhost:8000/api/spaces/1 \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"status":"available"}'
   # a student must NOT be allowed
   curl -i -X PATCH http://localhost:8000/api/spaces/2 \
     -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"status":"available"}'
   ```
3. Expected:
   - Bulk → `200` with `updated:[1,2,3]`, `skipped:[]`; re-reading shows them `disabled`.
   - Single re-enable → `200`, space 1 back to `available`.
   - Student token → `403` `{"error":{"code":"forbidden",...}}`.

**☁️ Cloud check (optional):** after `./release.sh backend`, repeat the bulk-disable against `http://<ElasticIp>` with a server admin token, then re-read the lot to confirm it persisted in RDS.
   - An invalid status (e.g. `{"status":"banana"}`) → `400`.

**Commit & push:**
```bash
git add -A && git commit -m "B5: admin enable/disable single + bulk spaces" && git push -u origin cr/b5-spaces
```

---

### CR B6 — Student registers interest

**Depends on:** B4. **Branch off B5.** **Unblocks frontend U5.**

**Goal:**
- `POST /api/interest` — body `{"lotId":1}` (student) → creates a `pending` interest. A second *pending* request → `409` (the DB index from B2 also enforces this).
- `GET /api/interest/me` — the student's own requests.
- `GET /api/interest` — admin sees all requests (optional `?status=` filter).

**Branch:**
```bash
git checkout cr/b5-spaces
git checkout -b cr/b6-interest
```

**Step 1 — Create `webapp/App/views/interest.py`:**
```python
# webapp/App/views/interest.py
import psycopg
from flask import Blueprint, request, jsonify, g

from ..db import query, query_one, execute
from ..auth import require_role

bp = Blueprint("interest", __name__)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


@bp.post("/api/interest")
@require_role("student")
def create_interest():
    body = request.get_json(silent=True) or {}
    lot_id = body.get("lotId")   # optional preferred lot
    # Block a second pending request (matches the DB unique index from B2).
    existing = query_one(
        "SELECT id FROM interest WHERE user_id = %s AND status='pending'", (g.user["id"],))
    if existing:
        return _err("conflict", "You already have an active request", 409)
    try:
        row = execute(
            "INSERT INTO interest (user_id, lot_id, status) VALUES (%s, %s, 'pending') "
            "RETURNING id, user_id, lot_id, status, created_at",
            (g.user["id"], lot_id))
    except psycopg.errors.UniqueViolation:
        return _err("conflict", "You already have an active request", 409)
    return jsonify({"data": {
        "id": row["id"], "userId": row["user_id"], "lotId": row["lot_id"],
        "status": row["status"], "createdAt": row["created_at"].isoformat(),
    }}), 201


@bp.get("/api/interest/me")
@require_role("student")
def my_interest():
    rows = query(
        "SELECT id, lot_id, status, created_at FROM interest "
        "WHERE user_id = %s ORDER BY created_at DESC", (g.user["id"],))
    return jsonify({"data": [{
        "id": r["id"], "lotId": r["lot_id"], "status": r["status"],
        "createdAt": r["created_at"].isoformat(),
    } for r in rows]})


@bp.get("/api/interest")
@require_role("admin")
def list_interest():
    status = request.args.get("status")
    sql = """
        SELECT i.id, i.lot_id, i.status, i.created_at,
               u.id AS uid, u.name AS uname, u.code AS ucode
        FROM interest i JOIN users u ON u.id = i.user_id
    """
    params = ()
    if status:
        sql += " WHERE i.status = %s"; params = (status,)
    sql += " ORDER BY i.created_at DESC"
    rows = query(sql, params)
    return jsonify({"data": [{
        "id": r["id"],
        "user": {"id": r["uid"], "name": r["uname"], "code": r["ucode"]},
        "lotId": r["lot_id"], "status": r["status"],
        "createdAt": r["created_at"].isoformat(),
    } for r in rows]})
```

**Step 2 — Register it** in `webapp/App/__init__.py`:
```python
    from .views import interest
    app.register_blueprint(interest.bp)
```

**Local testing guide:**
1. Setup: server running; `$S` = student token, `$A` = admin token.
2. Steps:
   ```bash
   curl -i -X POST http://localhost:8000/api/interest \
     -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1}'
   curl -i -X POST http://localhost:8000/api/interest \
     -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1}'  # again
   curl -s http://localhost:8000/api/interest/me -H "Authorization: Bearer $S"
   curl -s "http://localhost:8000/api/interest?status=pending" -H "Authorization: Bearer $A"
   ```
3. Expected:
   - First POST → `201` with a `pending` request.
   - Second POST → `409` (`You already have an active request`).
   - `/interest/me` (student) shows the one request; `/interest?status=pending` (admin) shows it with the student's name + code.
   - An admin hitting `POST /api/interest` → `403`; a student hitting `GET /api/interest` → `403`.

**☁️ Cloud check (optional):** after `./release.sh backend`, POST an interest to `http://<ElasticIp>/api/interest` with a server student token, then read it back with `/api/interest/me`. (This is the backend half of the full E2E flow in **Part 1E** — running it in the cloud means UI CR **U5** can be tested against the live server too.)

**Commit & push:**
```bash
git add -A && git commit -m "B6: student interest register + list (self/admin)" && git push -u origin cr/b6-interest
```

---

### CR B7 — Admin assigns a space

**Depends on:** B5 + B6. **Branch off B6.** **Unblocks frontend U6.**

**Goal:**
- `POST /api/assignments` — body `{"spaceId","userId"}` (optional `"interestId"`) → marks the space `assigned`, sets `assigned_user_id`, flips the matching interest to `fulfilled`, records who assigned it.
- `DELETE /api/assignments/:id` — undo an assignment (space back to `available`).

Both admin-only. We do all the writes inside **one database transaction** so they either *all* succeed or *all* roll back — you can never end up with a space marked assigned but no assignment row.

> **📸 Note — the frontend prototype also has a "student self-claim".** The UI prototype currently lets a *student* click an open spot and claim it directly (see the UI guide's U6 note). **That's not what this CR builds** — B7 is the planned flow: a student *registers interest* (B6), then an *admin* assigns the spot. `POST /api/assignments` here is **admin-only** on purpose.
>
> If the team later decides students should be able to self-claim for real (not just in the browser), that's a **separate future backend CR**, not part of B7. It would need its own student-facing endpoint — e.g. `POST /api/claims` — with its own rules: the caller must be a `student`, the space must be `available` (not disabled/assigned), and a student may hold **at most one** active claim (enforce it with a partial unique index, the same trick B6 uses for interest). Don't loosen this B7 endpoint to allow students — keep admin-assign and student-claim as distinct paths so each keeps its own authorization.

**Branch:**
```bash
git checkout cr/b6-interest
git checkout -b cr/b7-assignments
```

**Step 1 — Create `webapp/App/views/assignments.py`:**
```python
# webapp/App/views/assignments.py
import psycopg
from flask import Blueprint, request, jsonify, g

from ..db import query_one, get_db
from ..auth import require_role

bp = Blueprint("assignments", __name__)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


@bp.post("/api/assignments")
@require_role("admin")
def create_assignment():
    body = request.get_json(silent=True) or {}
    space_id, user_id = body.get("spaceId"), body.get("userId")
    interest_id = body.get("interestId")   # optional
    if not isinstance(space_id, int) or not isinstance(user_id, int):
        return _err("bad_request", "spaceId and userId (integers) are required", 400)

    space = query_one("SELECT id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if query_one("SELECT id FROM users WHERE id = %s", (user_id,)) is None:
        return _err("not_found", "User not found", 404)
    if space["status"] != "available":
        return _err("conflict", f"Space is {space['status']}, not assignable", 409)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO assignments (space_id, user_id, assigned_by, active) "
                "VALUES (%s, %s, %s, TRUE) "
                "RETURNING id, space_id, user_id, assigned_by, active, created_at",
                (space_id, user_id, g.user["id"]))
            a = cur.fetchone()
            cur.execute(
                "UPDATE spaces SET status='assigned', assigned_user_id=%s WHERE id=%s",
                (user_id, space_id))
            if interest_id is not None:
                cur.execute("UPDATE interest SET status='fulfilled' WHERE id=%s", (interest_id,))
            else:
                cur.execute(
                    "UPDATE interest SET status='fulfilled' "
                    "WHERE user_id=%s AND status='pending'", (user_id,))
        db.commit()
    except psycopg.errors.UniqueViolation:
        db.rollback()
        return _err("conflict", "Space already has an active assignment", 409)
    except Exception:
        db.rollback()
        raise

    return jsonify({"data": {
        "id": a["id"], "spaceId": a["space_id"], "userId": a["user_id"],
        "assignedBy": a["assigned_by"], "active": a["active"],
        "createdAt": a["created_at"].isoformat(),
    }}), 201


@bp.delete("/api/assignments/<int:assignment_id>")
@require_role("admin")
def delete_assignment(assignment_id):
    a = query_one("SELECT id, space_id, active FROM assignments WHERE id = %s",
                  (assignment_id,))
    if a is None:
        return _err("not_found", "Assignment not found", 404)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("UPDATE assignments SET active=FALSE WHERE id=%s", (assignment_id,))
            cur.execute(
                "UPDATE spaces SET status='available', assigned_user_id=NULL WHERE id=%s",
                (a["space_id"],))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return jsonify({"data": {"id": a["id"], "active": False,
                             "spaceId": a["space_id"], "spaceStatus": "available"}})
```

**Step 2 — Register it** in `webapp/App/__init__.py`:
```python
    from .views import assignments
    app.register_blueprint(assignments.bp)
```

**Local testing guide:**
1. Setup: server running; `$A` = admin token; first register interest as a student (B6) so there's a `pending` request. Use a known student id (Jane = `2`) and an available space id (e.g. `4`).
2. Steps:
   ```bash
   curl -i -X POST http://localhost:8000/api/assignments \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"spaceId":4,"userId":2}'
   # space 4 should now be 'assigned'
   curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"
   # the student's request should now be 'fulfilled'
   curl -s http://localhost:8000/api/interest/me -H "Authorization: Bearer $S"
   # try to assign the SAME space again -> 409
   curl -i -X POST http://localhost:8000/api/assignments \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"spaceId":4,"userId":3}'
   # undo (use the assignment id from the first response)
   curl -i -X DELETE http://localhost:8000/api/assignments/1 -H "Authorization: Bearer $A"
   ```
3. Expected:
   - POST → `201`; space 4 becomes `assigned` with `assignedUserId: 2`; the student's interest becomes `fulfilled`.
   - Re-assigning space 4 → `409`.
   - DELETE → `200`; re-reading the lot shows space 4 back to `available`.

**☁️ Cloud check (optional):** after `./release.sh backend`, run the assign → read → fulfilled sequence against `http://<ElasticIp>`. With B7 deployed, the **whole backend is live in the cloud** — now run the full two-window browser story from **Part 1E** against the deployed site (`./release.sh all`) as your real end-to-end cloud test.

**Commit & push:**
```bash
git add -A && git commit -m "B7: transactional assign + unassign" && git push -u origin cr/b7-assignments
```

---

### CR B8 — Save lot layout (spot positions)

**Depends on:** B7. **Branch off B7.** **Unblocks frontend U8.**

**Goal:**
- `PUT /api/lots/:id/layout` — admin-only, **full-replace** of a lot's spot set inside **one transaction**: upsert the spaces in the payload, delete the ones the payload omits. It **refuses (409)** to delete a space that is currently `assigned`, so re-arranging can never orphan a student's spot.

The columns this writes — `spaces.pos_x`, `pos_y`, `rotation` — are **already in the schema from B2** (they were designed in from the start; see the `spaces` table in CR B2), so B8 adds **no migration** — just the endpoint. Why normalized coordinates? Storing a fraction (`0.42`) instead of a pixel (`537px`) means the layout still lines up when the map is zoomed, resized, or shown on a phone; the front end multiplies by the rendered image size at paint time. This is the data that replaces the prototype's hard-coded `LOT_CONFIGS`/`LOT_MAP_CONFIGS` position tables.

> **Why `PUT` (full-replace) and not a pile of `POST`/`PATCH`/`DELETE`s?** The admin edits the whole lot on one canvas and hits **Save Layout** once. Sending the complete desired set and letting the server reconcile (add / move / remove) is **idempotent** — saving the same layout twice is a no-op — and it keeps the client simple: it doesn't have to track which individual spots it created, moved, or deleted. → [MDN: PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT).

**Branch:**
```bash
git checkout cr/b7-assignments
git checkout -b cr/b8-layout
```

**Step 1 — Add the endpoint to `webapp/App/views/lots.py`** (the blueprint you created in B4 — reuse its `bp`, `_err`, and imports):
```python
# add to webapp/App/views/lots.py
from ..db import query, query_one, get_db   # extend the existing import
from ..auth import require_role

@bp.put("/api/lots/<int:lot_id>/layout")
@require_role("admin")
def save_layout(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)

    body = request.get_json(silent=True) or {}
    incoming = body.get("spaces")
    if not isinstance(incoming, list):
        return _err("bad_request", "spaces (array) is required", 400)

    # Validate every entry BEFORE opening the transaction (fail fast).
    clean = []
    for s in incoming:
        label = s.get("label")
        x, y, rot = s.get("x"), s.get("y"), s.get("rotation")
        if not isinstance(label, str) or not label.strip():
            return _err("bad_request", "each space needs a non-empty label", 400)
        if not _is_frac(x) or not _is_frac(y):
            return _err("bad_request", "x and y must be numbers in 0..1", 400)
        clean.append({
            "id": s.get("id"),                       # None => new space
            "label": label.strip(),
            "x": float(x), "y": float(y),
            "rotation": float(rot) if isinstance(rot, (int, float)) else 0.0,
        })

    keep_ids = {c["id"] for c in clean if isinstance(c["id"], int)}
    existing = query("SELECT id, status FROM spaces WHERE lot_id = %s", (lot_id,))
    to_delete = [row["id"] for row in existing if row["id"] not in keep_ids]
    # Refuse to delete a space that's currently assigned to a student.
    blocked = [row["id"] for row in existing
               if row["id"] in to_delete and row["status"] == "assigned"]
    if blocked:
        return _err("conflict",
                    f"cannot delete assigned space(s): {blocked}", 409)

    db = get_db()
    try:
        with db.cursor() as cur:
            for c in clean:
                if isinstance(c["id"], int):
                    cur.execute(
                        "UPDATE spaces SET label=%s, pos_x=%s, pos_y=%s, rotation=%s "
                        "WHERE id=%s AND lot_id=%s",
                        (c["label"], c["x"], c["y"], c["rotation"], c["id"], lot_id))
                else:
                    cur.execute(
                        "INSERT INTO spaces (lot_id, label, pos_x, pos_y, rotation) "
                        "VALUES (%s, %s, %s, %s, %s)",
                        (lot_id, c["label"], c["x"], c["y"], c["rotation"]))
            if to_delete:
                cur.execute("DELETE FROM spaces WHERE id = ANY(%s)", (to_delete,))
        db.commit()
    except Exception:
        db.rollback()
        raise

    rows = query(
        "SELECT id, label, status, assigned_user_id, pos_x, pos_y, rotation "
        "FROM spaces WHERE lot_id = %s ORDER BY id", (lot_id,))
    return jsonify({"data": {"lotId": lot_id, "spaces": [
        {"id": r["id"], "label": r["label"], "status": r["status"],
         "assignedUserId": r["assigned_user_id"],
         "x": r["pos_x"], "y": r["pos_y"], "rotation": r["rotation"]}
        for r in rows]}})


def _is_frac(v):
    return isinstance(v, (int, float)) and 0 <= v <= 1
```

**Explanation, piece by piece:**
- **Validate before the transaction.** Every label/coordinate check runs on plain reads first, so the transaction only ever contains writes already known to be valid — the same fail-fast shape as B7. The `CHECK (pos_x/pos_y in 0..1)` constraint on the `spaces` table (from B2) is the database-level backstop if a bad value ever slips past the Python check.
- **Full-replace by reconciliation.** `keep_ids` are the spaces the client still wants; anything in the lot *not* in that set is `to_delete`. Payload entries **with** an `id` are `UPDATE`d (a move/relabel), entries **without** one are `INSERT`ed (a newly placed spot). → [PostgreSQL: UPDATE](https://www.postgresql.org/docs/current/sql-update.html) · [INSERT](https://www.postgresql.org/docs/current/sql-insert.html).
- **The 409 guard is the safety rule.** Before deleting anything, we check whether any to-be-deleted space is `assigned`; if so we bail with `409` and write nothing (this is [R8](../plan.md#12-risks--mitigations) in the plan). An admin can't accidentally delete a space a student is parked in — they'd have to unassign it first (B7's `DELETE`).
- **One transaction.** All the upserts and the delete run inside a single `with db.cursor()` block and one `db.commit()`, so a mid-save failure rolls the whole layout back — you never get half a saved map. Same transactional pattern as B7.
- **`= ANY(%s)`** lets one statement delete a whole list of ids; psycopg adapts a Python list to a Postgres array. → [psycopg: lists/arrays](https://www.psycopg.org/psycopg3/docs/basic/adapt.html#lists-adaptation).

**Local testing guide:**
1. Setup: server running; `$A` = admin token; `$S` = student token; pick a lot id (e.g. `1`).
2. Steps:
   ```bash
   # save a two-spot layout (no ids => both are new spaces)
   curl -i -X PUT http://localhost:8000/api/lots/1/layout \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"spaces":[{"label":"A1","x":0.25,"y":0.4,"rotation":0},
                     {"label":"A2","x":0.6,"y":0.4,"rotation":90}]}'
   # re-read: positions persisted
   curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"
   # a student may not save a layout -> 403
   curl -i -X PUT http://localhost:8000/api/lots/1/layout \
     -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"spaces":[]}'
   # out-of-range coordinate -> 400
   curl -i -X PUT http://localhost:8000/api/lots/1/layout \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"spaces":[{"label":"X","x":9,"y":0.1}]}'
   ```
3. Expected:
   - PUT with valid spaces → `200`; re-GET shows the saved `x`/`y`/`rotation`.
   - Omitting a previously-saved space's id deletes it — **unless** it's `assigned`, which returns `409` and changes nothing.
   - Student token → `403`; `x`/`y` outside `0..1` → `400`.

**☁️ Cloud check (optional):** after `./release.sh backend`, save a layout for a lot on the live server, then re-read it — positions persist in RDS. Best done end-to-end with the U8 editor once it's built (`./release.sh all`).

**Commit & push:**
```bash
git add -A && git commit -m "B8: save lot layout (positions) + spaces.pos_x/pos_y/rotation" && git push -u origin cr/b8-layout
```

---

### CR B9 — Create a parking lot

**Depends on:** B8. **Branch off B8.** **Unblocks frontend U9.**

**Goal:**
- `POST /api/lots` — admin-only. Body `{ "name", "capacity"?, "display_order"? }`. Inserts the lot and, if `capacity` is given, that many positionless `available` spaces (the admin places them later with B8's layout editor). Rejects a blank name (`400`) or a duplicate name (`409`).

This is the first endpoint that **creates a brand-new top-level resource** from the UI — it's what frees the app from the hard-coded "17 lots" seed loop and lets the school add lot 18 without a code change.

**Branch:**
```bash
git checkout cr/b8-layout
git checkout -b cr/b9-create-lot
```

**Step 1 — Add the endpoint to `webapp/App/views/lots.py`:**
```python
# add to webapp/App/views/lots.py
@bp.post("/api/lots")
@require_role("admin")
def create_lot():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    capacity = body.get("capacity")
    display_order = body.get("display_order")
    if not name:
        return _err("bad_request", "name is required", 400)
    if capacity is not None and (not isinstance(capacity, int) or capacity < 0):
        return _err("bad_request", "capacity must be a non-negative integer", 400)
    # Case-insensitive duplicate check (app-level; see note below).
    if query_one("SELECT id FROM lots WHERE lower(name) = lower(%s)", (name,)):
        return _err("conflict", "A lot with that name already exists", 409)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO lots (name, display_order) VALUES (%s, "
                "  COALESCE(%s, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM lots))) "
                "RETURNING id, name, display_order, map_image_url",
                (name, display_order))
            lot = cur.fetchone()
            for i in range(1, (capacity or 0) + 1):
                cur.execute(
                    "INSERT INTO spaces (lot_id, label) VALUES (%s, %s)",
                    (lot["id"], f"{lot['id']}-{i}"))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return jsonify({"data": {
        "id": lot["id"], "name": lot["name"],
        "displayOrder": lot["display_order"],
        "mapImageUrl": lot["map_image_url"],
        "capacity": capacity or 0, "availableCount": capacity or 0,
    }}), 201
```

**Explanation:**
- **Name required, then de-duplicated.** A blank name is `400`; a name that already exists (case-insensitive) is `409` — the client blocks blanks for UX, but the server is the real boundary. → [OWASP: Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).
- **`display_order` auto-appends.** If the caller doesn't pass one, `COALESCE(..., MAX+1)` puts the new lot at the end of the nav order.
- **Optional capacity seeds blank spaces.** When `capacity` is given, the loop inserts that many `available` spaces with **no** position (`pos_x/pos_y` stay `NULL`) — the admin arranges them in U8. The lot-plus-spaces insert is one transaction, so a failure creates neither.

> **Note — race-proofing the unique name.** The app-level `SELECT` check has a tiny time-of-check/time-of-use gap (two admins creating "North Lot" at the same instant). For a school-scale app that's acceptable; to make the database enforce it, add `CREATE UNIQUE INDEX lots_name_lower ON lots (lower(name));` in a migration and catch `psycopg.errors.UniqueViolation` → `409` (the same trick B7 uses for assignments). Deferred to the hardening CRs unless you want it now.

**Local testing guide:**
1. Setup: server running; `$A` = admin token; `$S` = student token.
2. Steps:
   ```bash
   curl -i -X POST http://localhost:8000/api/lots \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"name":"North Lot","capacity":10}'
   curl -s http://localhost:8000/api/lots -H "Authorization: Bearer $A"   # new lot listed
   # blank name -> 400 ; duplicate name -> 409 ; student -> 403
   curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
     -H 'Content-Type: application/json' -d '{"name":"   "}'
   curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
     -H 'Content-Type: application/json' -d '{"name":"North Lot"}'
   curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $S" \
     -H 'Content-Type: application/json' -d '{"name":"Sneaky"}'
   ```
3. Expected:
   - First POST → `201` with the new lot; `GET /api/lots` now lists it and `GET /api/lots/<newId>/spaces` returns 10 positionless spaces.
   - Blank name → `400`; duplicate name → `409`; student token → `403`.

**☁️ Cloud check (optional):** after `./release.sh backend`, create a lot on the live server and re-list — it persists in RDS. Full loop with the UI: create a lot (U9) → upload its map (U7) → arrange its spots (U8).

**Commit & push:**
```bash
git add -A && git commit -m "B9: create a parking lot (POST /api/lots)" && git push -u origin cr/b9-create-lot
```

---

### How the backend CRs and frontend CRs line up

| Build this backend CR | …then this frontend CR can be done |
|---|---|
| B3 (auth) | U1 (real login) |
| B4 (read lots/spaces) | U3 (data-driven map) |
| B5 (enable/disable) | U4 (persisted disable) |
| B6 (interest) | U5 (student registers interest) |
| B7 (assignments) | U6 (admin assigns) |
| B8 (save layout) | U8 (drag-and-drop arrange spots) |
| B9 (create lot) | U9 (add a lot from the UI) |

Build the backend CR first (or at least open its PR), because the frontend needs the endpoint to exist to test against. *(U7 — map upload — has no dedicated backend CR here; its `POST /api/lots/:id/map` endpoint is listed in the API surface and can be built alongside B8.)*

---

### Part 1E — End-to-end (E2E) test: backend + frontend together

Each CR above had a "Local testing guide" that poked **one endpoint** with `curl`. An **end-to-end test** runs the **real backend and the real frontend at the same time** and walks the whole user story through the browser. It's the truest check that everything fits: API, database transactions, auth tokens, and the UI.

> Do this once after **B7** is merged (both core features exist), and again before every deploy. This mirrors **Part F2** in the UI guide — same flow, described from the backend side.

#### Step 1 — Start PostgreSQL + the backend (Terminal 1)

```bash
cd ~/workspace/LTR-Backend
brew services start postgresql@16          # the version you installed in B2

source .venv/bin/activate                  # virtualenv from Part 0
# reset to clean, predictable data so the login codes/passwords are known:
psql "$DATABASE_URL" -f webapp/sql/migrations/001_init.sql
psql "$DATABASE_URL" -f webapp/sql/seed.sql

export FLASK_APP=webapp.App
flask run --port 8000
```
Sanity check (new terminal):
```bash
curl -s http://localhost:8000/api/health        # -> {"data":{"status":"ok"}}
```

#### Step 2 — Confirm the API works on its own (no UI yet)

Before bringing in the browser, prove the full chain with `curl`. This isolates "is it the backend or the frontend?" if anything later fails.
```bash
# 1) student logs in -> capture the token
STU_TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# 2) student registers interest in lot 1
curl -s -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $STU_TOKEN" -H 'Content-Type: application/json' -d '{"lotId":1}'

# 3) admin logs in -> capture token
ADM_TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/admin \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# 4) admin sees the pending request
curl -s "http://localhost:8000/api/interest?status=pending" -H "Authorization: Bearer $ADM_TOKEN"
```
Expect: step 2 returns the new interest with `"status":"pending"`; step 4 lists it. If these work, the backend is sound and any later failure is in the UI wiring.

#### Step 3 — Start the frontend (Terminal 2)

```bash
cd ~/workspace/lt-parking-site-project
# .env must contain: VITE_API_URL=http://localhost:8000
npm run dev
```
Open `http://localhost:5173`.

> **CORS:** the backend `.env` `CORS_ORIGINS` must include `http://localhost:5173` (set in B0/B1). A CORS error in the browser console means fix `.env` and restart Terminal 1.

#### Step 4 — Walk the full story (two browser windows)

Normal window = student, incognito window = admin (so both stay logged in).

| # | Window | Action | Expected |
|---|--------|--------|----------|
| 1 | Normal | Log in as `STU001` | Student dashboard, availability list |
| 2 | Normal | Register interest in a lot | "pending" shown |
| 3 | Incognito | Log in `admin` / `admin123` | Admin control board |
| 4 | Incognito | Manual Assign → pick the request → click a white space | Space turns blue; request leaves pending |
| 5 | Normal | Refresh | Request now **fulfilled** ✅ |

Watch **Terminal 1** while you click — you'll see the Flask request log (`POST /api/interest`, `POST /api/assignments`, …). That log is your proof the browser actually reached the backend.

#### Step 5 — Tear down

```bash
# Terminal 2: Ctrl-C   (Vite)
# Terminal 1: Ctrl-C   (Flask)
brew services stop postgresql@16     # optional
```

#### If something fails

- **`flask run` exits immediately** — usually `DATABASE_URL` unset or PostgreSQL not started. Re-check Step 1; run `psql "$DATABASE_URL" -c '\dt'` to confirm the tables exist.
- **Browser shows CORS / "Failed to fetch"** — backend down, wrong `VITE_API_URL`, or `CORS_ORIGINS` missing the Vite origin.
- **curl works but the UI doesn't** — the problem is frontend wiring, not the backend (that's exactly what Step 2 isolates).
- **Data is messy** — re-run Step 1's migrate + seed for a clean slate.

---

## Part 2 — Deploy to AWS → see the Deployment Guide

Deployment now lives in its own sibling document: **[`../deploy/deployment-guide.md`](../deploy/deployment-guide.md)**. It holds the full step-by-step deploy tutorial (CRs **D0–D4**), live-server operations & troubleshooting, and the architecture / IaC / cost reference.

- **Deploy the app to AWS (D0–D4):** [Deployment Guide → Part 1](../deploy/deployment-guide.md#part-1--deploy-to-aws-step-by-step-crs-d0d4)
- **Operate & troubleshoot the live server:** [Deployment Guide → Part 2](../deploy/deployment-guide.md#part-2--operating--troubleshooting-the-live-server)
- **Architecture, CloudFormation stacks & cost model:** [Deployment Guide → Part 3](../deploy/deployment-guide.md#part-3--reference-architecture-iac--cost-model)
- **Runnable templates & scripts:** repo-root [`deploy/`](../../deploy/README.md)

> You should have a working backend locally (through **B1**) before deploying.

---

## Part 4 — Daily backend checklist

1. `cd ~/workspace/LTR-Backend`
2. `source .venv/bin/activate` (prompt shows `(.venv)`)
3. `git status` (right branch? clean?)
4. `flask run --port 8000` in one terminal; test with `curl` in another.
5. Commit often: `git add -A && git commit -m "..."`.
6. `git push` when the CR is ready → open the PR against the parent branch.
7. To deploy: `cd deploy && ./release.sh all`.

---

## Appendix A — Backend API Reference (v1)

> **Moved here from `plan.md §7.1`** as part of the doc reorg — this is the backend design contract behind the step-by-step CRs above. The master plan links here from [`../plan.md §7`](../plan.md#7-implementation-details-live-in-the-two-guides); the frontend code that *calls* these endpoints is documented in the UI guide's [Frontend architecture reference](../ui/ui-development-guide.md#appendix--frontend-architecture-reference). The class/layer view is [`../plan.md §5.2`](../plan.md#52-backend-layering-component-classes).

### A.1 Target application structure

The clean target the CRs converge on. *(The repo today has this under `webapp/App/` — see [What it becomes as you finish the CRs](#what-it-becomes-as-you-finish-the-crs-the-target) for the file-by-file mapping to each CR.)*
```
LTR-Backend/
  app/
    __init__.py        # create_app(), CORS, blueprint + error registration
    config.py          # env-driven (SECRET_KEY, DATABASE_URL, CORS_ORIGINS)
    db.py              # get_db(), dict row factory, teardown, init-db CLI
    auth.py            # JWT issue/verify, @require_role decorator, password hashing
    blueprints/
      auth.py          # /api/auth/*
      lots.py          # /api/lots, /api/lots/<id>/spaces
      spaces.py        # PATCH /api/spaces, PATCH /api/spaces/<id>
      interest.py      # /api/interest*
      assignments.py   # /api/assignments*
  sql/
    schema.sql         # tables from plan.md §5.1
    seed.sql           # lots 1-17 + spaces + one admin
  tests/               # pytest
  bin/db, bin/run
  requirements.txt
  Dockerfile
```

### A.2 Conventions

- All endpoints return JSON; consistent envelope: success `{data: ...}`, error `{error: {code, message, details}}`.
- Auth: **JWT** in `Authorization: Bearer <token>`; `issue_token` signs `{user_id, role, exp}` with `SECRET_KEY`; `@require_role('admin')` guards admin routes (built in **B3**).
- Passwords: `werkzeug.security.generate_password_hash` / `check_password_hash` (admins only; students use codes).
- DB access via thin helpers in `db.py` (parametrized SQL); multi-table writes (the assignment flow) run in **one transaction** (**B7**).
- Validation: per-endpoint payload checks; reject unknown/oversized input; `400` with details.
- CORS: restrict to the SPA origin via env `CORS_ORIGINS`.

### A.3 Cross-cutting (backend side)

- **Config:** all settings come from env (loaded from `.env` locally, systemd `EnvironmentFile` on the server); never commit secrets (**B0**).
- **Seed data:** lots, sample spaces, one admin account, and a handful of student codes (**B2**, `seed.sql`).
- **Observability:** gunicorn `--access-logfile`/`--error-logfile` stream to the systemd journal (`journalctl -u ltride`); each line traces one request (`METHOD /api/... status`), the server end of the trace whose browser end is the UI's console/toast. Blast-radius signal for on-call = the rate of `5xx` and `401/403` lines in the journal.

### A.4 API surface (v1)

| Method | Path | Auth | Purpose | Built in |
|---|---|---|---|---|
| GET | `/api/health` | — | liveness | [B1](#cr-b1--health-check-prove-the-server-runs) |
| POST | `/api/auth/student` | — | login by code | [B3](#cr-b3--authentication-login) |
| POST | `/api/auth/admin` | — | login by username/password | [B3](#cr-b3--authentication-login) |
| POST | `/api/auth/logout` | any | invalidate/clear | [B3](#cr-b3--authentication-login) |
| GET | `/api/auth/me` | any | current user | [B3](#cr-b3--authentication-login) |
| GET | `/api/lots` | any | list lots | [B4](#cr-b4--read-lots--spaces) |
| GET | `/api/lots/:id/spaces` | any | spaces + status (+ positions) | [B4](#cr-b4--read-lots--spaces) |
| POST | `/api/lots` | admin | create a lot (+ optional blank spaces) | [B9](#cr-b9--create-a-parking-lot) |
| PUT | `/api/lots/:id/layout` | admin | save spot positions (full-replace) | [B8](#cr-b8--save-lot-layout-spot-positions) |
| PATCH | `/api/spaces/:id` | admin | enable/disable one | [B5](#cr-b5--admin-enablesdisables-spaces) |
| PATCH | `/api/spaces` | admin | bulk enable/disable | [B5](#cr-b5--admin-enablesdisables-spaces) |
| POST | `/api/lots/:id/map` | admin | upload/replace map image | (map upload, [U7](../ui/ui-development-guide.md#cr-u7--update-the-school-map-image)) |
| POST | `/api/interest` | student | register interest | [B6](#cr-b6--student-registers-interest) |
| GET | `/api/interest` | admin | list all interest | [B6](#cr-b6--student-registers-interest) |
| GET | `/api/interest/me` | student | own interest | [B6](#cr-b6--student-registers-interest) |
| POST | `/api/assignments` | admin | assign space → student | [B7](#cr-b7--admin-assigns-a-space) |
| DELETE | `/api/assignments/:id` | admin | unassign | [B7](#cr-b7--admin-assigns-a-space) |

### A.5 Request / response contracts

All requests/responses are `application/json`. Authenticated calls send `Authorization: Bearer <token>`. Errors use the envelope `{ "error": { "code": string, "message": string, "details"?: object } }` with the listed status codes.

#### `GET /api/health`
- **Request:** none.
- **200:** `{ "data": { "status": "ok", "time": "2026-06-29T12:00:00Z" } }`

#### `POST /api/auth/student`
- **Request:** `{ "code": "ABC123" }`
- **200:** `{ "data": { "token": "<jwt>", "user": { "id": 1, "role": "student", "name": "Jane Doe" } } }`
- **400** invalid body · **401** unknown/invalid code.

#### `POST /api/auth/admin`
- **Request:** `{ "username": "admin", "password": "secret" }`
- **200:** `{ "data": { "token": "<jwt>", "user": { "id": 9, "role": "admin", "name": "Site Admin" } } }`
- **400** invalid body · **401** bad credentials.

#### `POST /api/auth/logout`
- **Request:** none (Bearer token).
- **204:** no content.

#### `GET /api/auth/me`
- **Request:** none (Bearer token).
- **200:** `{ "data": { "id": 1, "role": "student", "name": "Jane Doe", "email": "jane@school.edu" } }`
- **401** missing/expired token.

#### `GET /api/lots`
- **Request:** none.
- **200:** `{ "data": [ { "id": 1, "name": "Lot 1", "displayOrder": 1, "mapImageUrl": "/maps/lot1.jpg", "capacity": 120, "availableCount": 37 } ] }`

#### `GET /api/lots/:id/spaces`
- **Request:** none. Path param `id` (lot id).
- **200:** `{ "data": { "lotId": 1, "spaces": [ { "id": 1001, "label": "1-0-3", "status": "available", "assignedUserId": null, "x": 0.25, "y": 0.4, "rotation": 0 } ] } }` — `x`/`y`/`rotation` are `null` for spaces with no authored position (the UI falls back to its config-table layout).
- **404** lot not found.

#### `POST /api/lots` *(admin)*
- **Request:** `{ "name": "North Lot", "capacity"?: 10, "display_order"?: 5 }` — `name` required (non-blank, unique, case-insensitive); `capacity` optional (≥ 0, seeds that many positionless `available` spaces); `display_order` optional (defaults to end).
- **201:** `{ "data": { "id": 18, "name": "North Lot", "displayOrder": 18, "mapImageUrl": null, "capacity": 10, "availableCount": 10 } }`
- **400** blank/invalid name or bad capacity · **403** not admin · **409** duplicate name.

#### `PUT /api/lots/:id/layout` *(admin)*
- **Request:** `{ "spaces": [ { "id"?: 1001, "label": "A1", "x": 0.25, "y": 0.4, "rotation"?: 0 } ] }` — full desired set. Entries **with** `id` are moved/relabeled; entries **without** `id` are created; existing spaces **omitted** from the array are deleted. `x`/`y` are normalized fractions in `0..1`; `rotation` is degrees (defaults to 0).
- **200:** `{ "data": { "lotId": 1, "spaces": [ { "id": 1001, "label": "A1", "status": "available", "assignedUserId": null, "x": 0.25, "y": 0.4, "rotation": 0 } ] } }` (the full saved set).
- **400** missing `spaces` array / label / out-of-range coordinate · **403** not admin · **404** lot not found · **409** an omitted (to-be-deleted) space is currently `assigned` (nothing is written).

#### `PATCH /api/spaces/:id` *(admin)*
- **Request:** `{ "status": "disabled" }` — `status ∈ {available, disabled}`.
- **200:** `{ "data": { "id": 1001, "label": "1-0-3", "status": "disabled", "assignedUserId": null } }`
- **400** invalid status · **403** not admin · **404** space not found · **409** space is currently assigned.

#### `PATCH /api/spaces` *(admin, bulk)*
- **Request:** `{ "ids": [1001, 1002, 1003], "status": "disabled" }`
- **200:** `{ "data": { "updated": [ { "id": 1001, "status": "disabled" }, { "id": 1002, "status": "disabled" } ], "skipped": [ { "id": 1003, "reason": "assigned" } ] } }`
- **400** invalid body · **403** not admin.

#### `POST /api/lots/:id/map` *(admin)*
- **Request:** `multipart/form-data` with field `file` (png/jpg/jpeg/gif, ≤ 16 MB).
- **201:** `{ "data": { "lotId": 1, "mapImageUrl": "/maps/lot1-<hash>.jpg" } }`
- **400** missing/invalid file · **403** not admin · **413** too large.

#### `POST /api/interest` *(student)*
- **Request:** `{ "lotId": 1 }` — `lotId` optional (preferred lot).
- **201:** `{ "data": { "id": 55, "userId": 1, "lotId": 1, "status": "pending", "createdAt": "2026-06-29T12:00:00Z" } }`
- **400** invalid body · **403** not student · **409** active request already exists.

#### `GET /api/interest` *(admin)*
- **Request:** optional query `?status=pending|fulfilled|declined`.
- **200:** `{ "data": [ { "id": 55, "user": { "id": 1, "name": "Jane Doe", "code": "ABC123" }, "lotId": 1, "status": "pending", "createdAt": "2026-06-29T12:00:00Z" } ] }`
- **403** not admin.

#### `GET /api/interest/me` *(student)*
- **Request:** none (Bearer token).
- **200:** `{ "data": [ { "id": 55, "lotId": 1, "status": "pending", "createdAt": "2026-06-29T12:00:00Z" } ] }`

#### `POST /api/assignments` *(admin)*
- **Request:** `{ "spaceId": 1001, "userId": 1 }` — optionally `{ "interestId": 55 }` to fulfill a specific request.
- **201:** `{ "data": { "id": 200, "spaceId": 1001, "userId": 1, "assignedBy": 9, "active": true, "createdAt": "2026-06-29T12:00:00Z" } }` (also sets space → `assigned` and matching interest → `fulfilled`).
- **400** invalid body · **403** not admin · **404** space/user not found · **409** space not assignable (disabled or already assigned).

#### `DELETE /api/assignments/:id` *(admin)*
- **Request:** none. Path param `id` (assignment id).
- **200:** `{ "data": { "id": 200, "active": false, "spaceId": 1001, "spaceStatus": "available" } }` (frees the space).
- **403** not admin · **404** assignment not found.

---

## Appendix B — AWS Deployment Reference → moved

The AWS deployment reference (architecture, IaC layout, per-stack CloudFormation snippets, the AWS-services inventory + diagram, and the monthly + professional cost model) moved to the Deployment Guide: **[`../deploy/deployment-guide.md` → Part 3 (Reference)](../deploy/deployment-guide.md#part-3--reference-architecture-iac--cost-model)**.
