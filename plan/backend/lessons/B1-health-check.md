# Lesson B1 — Health check (prove the server runs)

> **Track:** Backend · **Lesson 2 of 10** (B0 → B9)
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle (one small file, one endpoint — but it's the pattern you'll repeat in every backend lesson from here on)
> **🧩 Prerequisites:** you've finished [Lesson B0 — Clean slate & safety](B0-clean-slate-and-safety.md) (`.gitignore` in place, `backend/webapp/requirements.txt` installed, `config.py` reading `SECRET_KEY`/`DATABASE_URL` from `.env`).
> **🌿 CR branch:** `cr/b1-health` (off `cr/b0-hygiene`) · **📄 Source CR:** [backend guide → CR B1](../backend-development-guide.md#cr-b1--health-check-prove-the-server-runs) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

> **New words ahead?** Terms like [Flask](GLOSSARY.md#flask), [Blueprint](GLOSSARY.md#blueprint), and [CORS](GLOSSARY.md#cors) link to the shared [**Glossary**](GLOSSARY.md) the first time each lesson uses them — one plain-language sentence per word. Click through whenever a word is new; you never have to memorize one before the lesson needs it.

## Run it & check your changes

One script brings up the whole stack — Postgres, the Flask API, and the React UI —
so you can see your changes running end-to-end:

```bash
scripts/local.sh up        # first run also sets up the database + dependencies
scripts/local.sh restart   # re-run this after you change code
scripts/local.sh down      # stop everything
```

- **UI:** http://localhost:5173
- **API health:** http://localhost:8000/api/health
- **Seeded logins (local dev only):** `admin` / `admin123`, or student codes `STU001`–`STU004`

Full runbook and troubleshooting: [`running-the-poc.md`](../running-the-poc.md).

## 🎯 Goal — what you'll have at the end

A **[Flask](GLOSSARY.md#flask) server you started yourself**, answering a real request over HTTP for the first time. Concretely, by the end of this hour you will have:

- A new file `backend/webapp/App/views/health.py` — a **[Blueprint](GLOSSARY.md#blueprint)** with one [route](GLOSSARY.md#route), `GET /api/health`, that returns `{"data":{"status":"ok","time":"..."}}`.
- A rewritten `backend/webapp/App/__init__.py` — the **[app factory](GLOSSARY.md#app-factory)** (`create_app()`) that builds the Flask app, turns on [CORS](GLOSSARY.md#cors), registers the health blueprint, and defines a consistent JSON shape for 404 and 500 errors.
- A server running locally at `http://localhost:8000` that you talk to with [`curl`](GLOSSARY.md#curl).

**🖼 Before → after — what the API does (this is what you're changing):**

```text
BEFORE  — nothing is listening; the request can't even connect
  $ curl -i http://localhost:8000/api/health
  curl: (7) Failed to connect to localhost port 8000: Connection refused

AFTER   — your Flask server answers, with a consistent JSON envelope
  $ curl -i http://localhost:8000/api/health
  HTTP/1.1 200 OK
  Content-Type: application/json
  {"data":{"status":"ok","time":"2026-01-01T12:00:00+00:00"}}

  $ curl -i http://localhost:8000/api/does-not-exist
  HTTP/1.1 404 NOT FOUND
  {"error":{"code":"not_found","message":"Not found"}}
```

**✅ Done when (your deliverable checklist):**
- [ ] `flask run --port 8000` starts with no errors and keeps running (you leave it in its own terminal).
- [ ] `curl -i http://localhost:8000/api/health` returns `200` and a body like `{"data":{"status":"ok","time":"...."}}`.
- [ ] `curl -i http://localhost:8000/api/does-not-exist` returns `404` and `{"error":{"code":"not_found","message":"Not found"}}`.
- [ ] Your work is committed on branch `cr/b1-health` and pushed, PR base = `main`.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

Right now the backend is just files sitting on disk — nothing is *running*, and nothing has ever answered a request. Before you add logins, a database, or parking spaces, you need to prove the most basic loop works: **the server starts, listens on a port, matches a URL to a function, and sends JSON back.** If that loop doesn't work, nothing built on top of it will either — so you prove it first, with the smallest possible endpoint.

This lesson also introduces two patterns every later endpoint reuses:

1. **Blueprints.** Instead of writing every route in one giant file, each feature area (health, auth, lots, spaces, ...) gets its own small file with its own `Blueprint`. `__init__.py` just collects and registers them. `views/health.py` today looks exactly like `views/lots.py` will in lesson B4.
2. **The app factory.** `create_app()` is the one function that assembles the whole app (config, CORS, blueprints, error handlers) and returns it. Flask's own docs recommend this pattern specifically so the same code can build a "real" app and a "test" app identically.

There's a practical payoff too: `/api/health` becomes your **first troubleshooting tool** for the rest of the project. Once this is deployed (CR D-something later), if the site ever looks broken, the very first thing you or a teammate does is `curl http://<server>/api/health` — if that fails, the problem is the server/deploy; if it succeeds, the problem is somewhere else.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Flask** | The Python web framework the whole backend runs on. | [Flask docs](https://flask.palletsprojects.com/) |
| **Blueprint** | A named, self-contained group of related routes you register with the app. | [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) |
| **App factory (`create_app()`)** | One function that builds and returns a fully-configured Flask app. | [Flask: Application factories](https://flask.palletsprojects.com/en/stable/patterns/appfactories/) |
| **Route / HTTP method decorator (`@bp.get(...)`)** | Ties a URL + method (GET/POST/...) to the function that handles it. | [Flask: HTTP methods](https://flask.palletsprojects.com/en/stable/quickstart/#http-methods) |
| **`jsonify()`** | Converts a Python dict into a proper JSON HTTP response. | [Flask API: `jsonify`](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify) |
| **CORS** | The browser security rule that blocks a page on one address from calling an API on another — `flask-cors` opts specific origins back in. | [flask-cors docs](https://flask-cors.readthedocs.io/en/latest/) |
| **Error handler (`@app.errorhandler`)** | Lets you control exactly what JSON an error (404, 500, ...) sends back, instead of Flask's default HTML page. | [Flask: Handling application errors](https://flask.palletsprojects.com/en/stable/errorhandling/) |
| **HTTP status codes (200, 404, 500)** | The 3-digit number in a response that tells you success/failure at a glance. | [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) |
| **`curl`** | The terminal tool you use to send an HTTP request and see the raw response, without a browser. | [curl man page](https://curl.se/docs/manpage.html) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → clear the old template routes (5) → create `health.py` (15) → rewrite `__init__.py` (15) → run the server (10) → prove it with `curl` & commit (10).

**Open your terminal, activate the virtual environment, and branch off B0** — B1 stacks directly on top of the branch you made last lesson, not on `main`:

```bash
git checkout cr/b0-hygiene
git checkout -b cr/b1-health
```

**What this does & why:** you're branching off `cr/b0-hygiene` (not `main`) because this CR needs B0's `.env`/`config.py` work to already exist. That's what "stacked CRs" means — each lesson's branch starts from the previous lesson's branch, so the review history matches the build order. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Clear the old template routes (~5 min)

The course template's `App/` still has the scaffold this repo started from — a
different, older pattern (one global `app` object, routes attached straight to
it) that doesn't match the blueprint + factory pattern you're about to build.
Left in place, it crashes the import as soon as you register a blueprint below.
Delete it now, before you write anything new:

**macOS / Linux**

```bash
rm backend/webapp/App/model.py backend/webapp/App/index.py
rm backend/webapp/App/views/index.py backend/webapp/App/views/root.py backend/webapp/App/views/images.py
```

**Windows (PowerShell)**

```powershell
Remove-Item backend\webapp\App\model.py, backend\webapp\App\index.py
Remove-Item backend\webapp\App\views\index.py, backend\webapp\App\views\root.py, backend\webapp\App\views\images.py
```

Then open `backend/webapp/App/views/__init__.py` and replace its contents with just a
docstring — this package should do nothing but mark `views/` as a Python
package until each lesson adds its own module:

```python
"""Route blueprints, one module per feature area (health, auth, lots, ...)."""
```

**Why delete instead of just leaving them unused?** An unused file that still
imports the old global `app` (e.g. `from App import app`) will `ImportError`
the moment Python tries to import the `App` package — even if nothing calls
it. Dead code that fails to import isn't harmless, it's a landmine. Better to
remove it now than debug a mysterious import crash in Step 4.

### Step 2 — Create the health route (~15 min)

In `backend/webapp/App/views/`, create a new file `health.py`:

```python
# backend/webapp/App/views/health.py
from datetime import datetime, timezone
from flask import Blueprint, jsonify

# A Blueprint is a group of related routes; __init__.py registers it on the app.
# Every future feature area (auth, lots, spaces, ...) starts with this same line.
bp = Blueprint("health", __name__)

@bp.get("/api/health")                       # decorator: run this function for GET /api/health
def health():
    now = datetime.now(timezone.utc).isoformat()          # live UTC timestamp → proves the answer isn't cached
    return jsonify({"data": {"status": "ok", "time": now}})  # wrap in the {"data": ...} envelope everything uses
```

**Why it works & further reading:**
- **[`jsonify`](GLOSSARY.md#jsonify)** turns a Python dict into a real HTTP [response](GLOSSARY.md#response) with the `Content-Type: application/json` header set — plain `return {...}` works in modern Flask too, but `jsonify` is explicit. → [`jsonify` docs](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify)
- **[`@bp.get(...)`](GLOSSARY.md#decorator)** is shorthand for "handle **GET** requests at this URL"; the [route](GLOSSARY.md#route) string is the address clients call. → [Flask: HTTP methods](https://flask.palletsprojects.com/en/stable/quickstart/#http-methods)
- **The `{"data": ...}` [envelope](GLOSSARY.md#envelope)** — successful responses wrap their payload in `data` (errors wrap in `error`, see Step 3), so the frontend can always expect the same shape. → [Python: `datetime.isoformat`](https://docs.python.org/3/library/datetime.html#datetime.date.isoformat)

### Step 3 — Write the app factory (~15 min)

Open `backend/webapp/App/__init__.py` and replace its contents with this:

```python
# backend/webapp/App/__init__.py
from flask import Flask, jsonify
from flask_cors import CORS

from . import config


def create_app():                            # app factory: one function builds + returns the whole app
    app = Flask(__name__)
    app.config["SECRET_KEY"] = config.SECRET_KEY   # the secret from .env (B0); Flask signs tokens/cookies with it

    # Allow the React dev server (and later the real site) to call this API.
    # A different port counts as a different origin, so the browser blocks it unless we opt it in here.
    CORS(app, origins=config.CORS_ORIGINS.split(","), supports_credentials=True)

    # Register every blueprint (group of routes). Each later CR adds its own import + register line here.
    from .views import health
    app.register_blueprint(health.bp)

    # Turn any uncaught error into our standard JSON error envelope so the
    # frontend always gets predictable shapes instead of Flask's HTML error page.
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": {"code": "not_found", "message": "Not found"}}), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": {"code": "server_error", "message": "Server error"}}), 500

    return app


# Module-level app object lets `flask run` find it via FLASK_APP=webapp.App
app = create_app()
```

**Why it works & further reading:**
- **[App factory](GLOSSARY.md#app-factory) (`create_app()`)** — building the app *inside a function* (not at import time) lets automated tests later build a second, separate app without the two interfering. → [Flask: Application factories](https://flask.palletsprojects.com/en/stable/patterns/appfactories/)
- **[`SECRET_KEY`](GLOSSARY.md#secret_key)** comes from the [`.env`](GLOSSARY.md#environment-variable) you set up in [Lesson B0](B0-clean-slate-and-safety.md); Flask uses it to sign things like session cookies. → [Flask: `SECRET_KEY`](https://flask.palletsprojects.com/en/stable/config/#SECRET_KEY)
- **[CORS](GLOSSARY.md#cors)** opts in exactly the addresses listed in `.env` — without it, a tab on `http://localhost:5173` (React) can't call `http://localhost:8000` (this API), because a different port is a different origin. → [flask-cors docs](https://flask-cors.readthedocs.io/en/latest/)
- **[Error handlers](GLOSSARY.md#error-handler)** override Flask's default HTML error page so **every** error comes back as the same `{"error": {...}}` JSON the frontend parses uniformly. → [Flask: Handling application errors](https://flask.palletsprojects.com/en/stable/errorhandling/)
- **`app = create_app()` at module level** is what lets the `flask run` command find an app object when `FLASK_APP` points at this module.

### Step 4 — Run the server (~10 min)

The `FLASK_APP` value below (`webapp.App`) is a Python **module path**, not a filesystem path — it only resolves with your current directory set to `backend/` (that's where the `webapp` package lives). `cd` there first, venv still active:

**macOS / Linux**

```bash
cd backend
export FLASK_APP=webapp.App
flask run --port 8000
```

**Windows (PowerShell)**

```powershell
cd backend
$env:FLASK_APP = "webapp.App"
flask run --port 8000
```

**What this does & why:** `FLASK_APP=webapp.App` tells the `flask` command-line tool *which module* has your app object (`backend/webapp/App/__init__.py`, imported as `webapp.App` once your current directory is `backend/`). `flask run --port 8000` starts Flask's built-in development server listening on port `8000`. Leave this terminal running — it prints a log line for every request it receives — and do the next section in a **second** terminal. → Reference: [Flask CLI: `flask run`](https://flask.palletsprojects.com/en/stable/cli/#run-the-development-server)

> If you get `ModuleNotFoundError: webapp`, you're in the wrong folder — run it from `~/workspace/lt-parking-site-project/backend` (where `ls` shows the `webapp/` folder). **Windows:** `cd $HOME\workspace\lt-parking-site-project\backend`.

> **The reference repo's convenience wrapper — `webapp/bin/server`.** Typing `export FLASK_APP=…` and `flask run` every time gets tedious, so the shipped implementation includes a small script, `backend/webapp/bin/server`, with `start` / `stop` / `restart` / `status` subcommands. It backgrounds the server, writes its process id and logs under `backend/webapp/var/` (the folder you git-ignored in B0), and honors `LTRIDE_HOST` / `LTRIDE_PORT` overrides. You don't need it to finish this lesson — plain `flask run` is enough — but it's the script the day-to-day PoC workflow uses; full usage is in [running the PoC](../running-the-poc.md). **Windows note:** this is a `#!/bin/bash` script — run it from **Git Bash** (Git for Windows) or **WSL**, not PowerShell/`cmd`.

---

## 🧪 Prove it works — testing guide

**Setup:** venv active; `.env` exists (from B0); `flask run --port 8000` running in its own terminal.

In a **second** terminal, run:

**macOS / Linux**

```bash
curl -i http://localhost:8000/api/health
curl -i http://localhost:8000/api/does-not-exist
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod http://localhost:8000/api/health
curl.exe -i http://localhost:8000/api/does-not-exist
```

> **Why `curl.exe` for the second line?** `Invoke-RestMethod` throws an exception on any non-2xx response instead of printing the body, so it can't show you a `404`. `curl.exe` (bundled with Windows 10+) behaves like Linux `curl` and prints the status + body as-is — use it whenever a step is deliberately checking an error status code. Later lessons/CRs reuse this same split.

**What you should see:**
1. The first command returns `200` and a body like `{"data":{"status":"ok","time":"...."}}`.
2. The second command returns `404` and `{"error":{"code":"not_found","message":"Not found"}}` — proving the error envelope from Step 3 works for a route that doesn't exist.

**☁️ Cloud check (optional).** If you've already stood up the AWS server (Part 2, CRs D0–D2 in the guide), run the repeatable deploy recipe and hit the real server:

**macOS / Linux**

```bash
git push
cd ~/workspace/lt-parking-site-project
scripts/deploy.sh app backend
scripts/deploy.sh infra outputs        # note the ElasticIp

curl -i http://<ElasticIp>/api/health     # expect 200 {"data":{"status":"ok",...}}
```

**Windows (PowerShell)**

```powershell
git push
cd $HOME\workspace\lt-parking-site-project
```

`scripts/deploy.sh` is a `#!/bin/bash` script — run these two from **Git Bash** (Git for Windows) or **WSL**, not PowerShell/`cmd`:

```bash
scripts/deploy.sh app backend
scripts/deploy.sh infra outputs        # note the ElasticIp
```

Back in PowerShell (or Git Bash — either works for a plain GET):

```powershell
Invoke-RestMethod http://<ElasticIp>/api/health     # expect {"data":{"status":"ok",...}}
```

This is the best *first* cloud check in the whole project — if `/api/health` answers on the real server, your entire deploy pipeline (git pull → gunicorn → nginx) is healthy, before you've risked anything more complex.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B1: add GET /api/health endpoint via blueprint + app factory with 404/500 JSON error envelope"
git push -u origin cr/b1-health
```

Then open a Pull Request on GitHub with **base = `main`**. Use the CR description template and paste your `curl` output from "Prove it works" as the testing evidence. The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`ImportError` mentioning `App.views.index` or `App.app`** — you skipped [Step 1](#step-1--clear-the-old-template-routes-5-min); one of the old template files is still importing the global `app` object that no longer exists once you're on the factory pattern. Delete the files listed in Step 1 and make sure `backend/webapp/App/views/__init__.py` is just the one-line docstring.
- **`ModuleNotFoundError: webapp` when running `flask run`** — you're in the wrong folder. Run it from `~/workspace/lt-parking-site-project/backend`, where `ls` shows the `webapp/` folder.
- **`KeyError: 'SECRET_KEY'` on startup** — your `.env` from [Lesson B0](B0-clean-slate-and-safety.md) is missing or in the wrong folder (must be inside `backend/`). Re-check that lesson's Step 4.
- **`curl: (7) Failed to connect... Connection refused`** — the server isn't actually running. Check the first terminal for errors, or that you didn't close it.
- **`Address already in use` when starting `flask run`** — something else (maybe an old `flask run`) is already on port 8000. Find and stop it, or run on a different port, e.g. `flask run --port 8001`, and adjust your `curl` commands to match.
- **`curl` to `/api/health` returns `404`** — check that `app.register_blueprint(health.bp)` in `__init__.py` actually runs, and that the route in `health.py` is spelled `/api/health` exactly.

---

## 📝 Recap — what you built and learned

- You wrote your first **Blueprint** (`health.py`) — the pattern every future endpoint file (`auth.py`, `lots.py`, `spaces.py`, ...) will follow.
- You wrote the **app factory** (`create_app()`) that assembles the app: config, CORS, blueprints, and a consistent JSON error envelope for 404/500.
- You **ran the Flask dev server for the first time** and talked to it with `curl` from a second terminal.
- You proved the full request→route→JSON-response loop works, end to end, on the smallest possible endpoint — the foundation every later lesson builds on.

---

## 📚 References

- [Flask documentation](https://flask.palletsprojects.com/) — the framework this backend is built on.
- [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) and [Application factories](https://flask.palletsprojects.com/en/stable/patterns/appfactories/).
- [Flask: HTTP methods](https://flask.palletsprojects.com/en/stable/quickstart/#http-methods) and [Handling application errors](https://flask.palletsprojects.com/en/stable/errorhandling/).
- [Flask API: `jsonify`](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify) and [`SECRET_KEY` config](https://flask.palletsprojects.com/en/stable/config/#SECRET_KEY).
- [Flask CLI: `flask run`](https://flask.palletsprojects.com/en/stable/cli/#run-the-development-server).
- [flask-cors documentation](https://flask-cors.readthedocs.io/en/latest/) — allowing the frontend to call this API.
- [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status).
- [curl man page](https://curl.se/docs/manpage.html).
- [Git Branching — Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).
- Source of truth for this lesson: [backend guide → CR B1](../backend-development-guide.md#cr-b1--health-check-prove-the-server-runs).

---

## ➡️ Next lesson

**[Lesson B2 — Database schema & seed data](B2-database-schema-and-seed.md).** You'll create the real PostgreSQL tables and load a little test data, so the endpoints you build from B4 onward have something real to read from. → [source CR](../backend-development-guide.md#cr-b2--database-schema--seed-data).
