# Lesson B1 — Health check (prove the server runs)

> **Track:** Backend · **Lesson 2 of 8** (B0 → B7)
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle (one small file, one endpoint — but it's the pattern you'll repeat in every backend lesson from here on)
> **🧩 Prerequisites:** you've finished [Lesson B0 — Clean slate & safety](B0-clean-slate-and-safety.md) (`.gitignore` in place, `webapp/requirements.txt` installed, `config.py` reading `SECRET_KEY`/`DATABASE_URL` from `.env`).
> **🌿 CR branch:** `cr/b1-health` (off `cr/b0-hygiene`) · **📄 Source CR:** [backend guide → CR B1](../backend-development-guide.md#cr-b1--health-check-prove-the-server-runs) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

A **Flask server you started yourself**, answering a real request over HTTP for the first time. Concretely, by the end of this hour you will have:

- A new file `webapp/App/views/health.py` — a **Blueprint** with one route, `GET /api/health`, that returns `{"data":{"status":"ok","time":"..."}}`.
- A rewritten `webapp/App/__init__.py` — the **app factory** (`create_app()`) that builds the Flask app, turns on CORS, registers the health blueprint, and defines a consistent JSON shape for 404 and 500 errors.
- A server running locally at `http://localhost:8000` that you talk to with `curl`.

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

**Time budget for the hour:** setup & branch (5 min) → create `health.py` (15) → rewrite `__init__.py` (20) → run the server (10) → prove it with `curl` & commit (10).

**Open your terminal, activate the virtual environment, and branch off B0** — B1 stacks directly on top of the branch you made last lesson, not on `main`:

```bash
git checkout cr/b0-hygiene
git checkout -b cr/b1-health
```

**What this does & why:** you're branching off `cr/b0-hygiene` (not `main`) because this CR needs B0's `.env`/`config.py` work to already exist. That's what "stacked CRs" means — each lesson's branch starts from the previous lesson's branch, so the review history matches the build order. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Create the health route (~15 min)

In `webapp/App/views/`, create a new file `health.py`:

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

**Explanation, line by line:**
- `from flask import Blueprint, jsonify` — `Blueprint` is the class you use to group routes; `jsonify` turns a Python dict into a real HTTP response with the `Content-Type: application/json` header set correctly (plain `return {...}` works in modern Flask too, but `jsonify` is explicit about what's happening). → [`jsonify` docs](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify)
- `bp = Blueprint("health", __name__)` — creates the blueprint object named `"health"`. Every future feature area (`auth`, `lots`, `spaces`, ...) will start with this same line, just with a different name. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/)
- `@bp.get("/api/health")` — a decorator that's shorthand for "register this function to handle **GET** requests at `/api/health`." → [Flask: HTTP methods](https://flask.palletsprojects.com/en/stable/quickstart/#http-methods)
- `datetime.now(timezone.utc).isoformat()` — the current time in UTC, formatted as text. Including a timestamp in the response is a cheap, useful way to prove the answer is *live*, not cached or hard-coded. → [Python: `datetime.isoformat`](https://docs.python.org/3/library/datetime.html#datetime.date.isoformat)
- `return jsonify({"data": {...}})` — the whole app wraps successful responses in a `{"data": ...}` envelope (and errors in `{"error": ...}`, see Step 2) so the frontend can always expect the same shape.

### Step 2 — Write the app factory (~20 min)

Open `webapp/App/__init__.py` and replace its contents with this:

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

**Explanation, line by line:**
- `def create_app():` — the **app factory** pattern: one function builds and returns a fully-wired app, instead of building it at import time. This makes it possible to build a second, separate app for automated tests later without the two interfering with each other. → [Flask: Application factories](https://flask.palletsprojects.com/en/stable/patterns/appfactories/)
- `app.config["SECRET_KEY"] = config.SECRET_KEY` — hands Flask the secret you moved into `.env` back in [Lesson B0](B0-clean-slate-and-safety.md); Flask uses it to sign things like session cookies later. → [Flask: `SECRET_KEY`](https://flask.palletsprojects.com/en/stable/config/#SECRET_KEY)
- `CORS(app, origins=config.CORS_ORIGINS.split(","), supports_credentials=True)` — without this, a browser tab open on `http://localhost:5173` (the React dev server) would be **blocked** from calling `http://localhost:8000` (this API) — different port counts as a different origin. `origins=...` opts in exactly the addresses listed in `.env`, nothing more. → [flask-cors docs](https://flask-cors.readthedocs.io/en/latest/)
- `from .views import health` / `app.register_blueprint(health.bp)` — imports the blueprint you wrote in Step 1 and plugs it into the app. Every future view module gets its own import + register line here.
- `@app.errorhandler(404)` / `@app.errorhandler(500)` — by default Flask returns an HTML error page; these two decorators override that so **every** error, from any route, comes back as the same `{"error": {"code": ..., "message": ...}}` JSON shape the frontend can parse uniformly. → [Flask: Handling application errors](https://flask.palletsprojects.com/en/stable/errorhandling/)
- `app = create_app()` at module level — this is what lets the command-line tool `flask run` find an app object automatically when you point `FLASK_APP` at this module.

### Step 3 — Run the server (~10 min)

In this same terminal (venv active, repo root), start the dev server:

```bash
export FLASK_APP=webapp.App
flask run --port 8000
```

**What this does & why:** `FLASK_APP=webapp.App` tells the `flask` command-line tool *which module* has your app object (`webapp/App/__init__.py`, imported as `webapp.App`). `flask run --port 8000` starts Flask's built-in development server listening on port `8000`. Leave this terminal running — it prints a log line for every request it receives — and do the next section in a **second** terminal. → Reference: [Flask CLI: `flask run`](https://flask.palletsprojects.com/en/stable/cli/#run-the-development-server)

> If you get `ModuleNotFoundError: webapp`, you're in the wrong folder — run it from `~/workspace/LTR-Backend` (where `ls` shows the `webapp/` folder).

---

## 🧪 Prove it works — testing guide

**Setup:** venv active; `.env` exists (from B0); `flask run --port 8000` running in its own terminal.

In a **second** terminal, run:

```bash
curl -i http://localhost:8000/api/health
curl -i http://localhost:8000/api/does-not-exist
```

**What you should see:**
1. The first command returns `200` and a body like `{"data":{"status":"ok","time":"...."}}`.
2. The second command returns `404` and `{"error":{"code":"not_found","message":"Not found"}}` — proving the error envelope from Step 2 works for a route that doesn't exist.

**☁️ Cloud check (optional).** If you've already stood up the AWS server (Part 2, CRs D0–D2 in the guide), run the repeatable deploy recipe and hit the real server:

```bash
git push
cd ~/workspace/LTR-Backend/deploy
./release.sh backend
./deploy.sh outputs        # note the ElasticIp

curl -i http://<ElasticIp>/api/health     # expect 200 {"data":{"status":"ok",...}}
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

- **`ModuleNotFoundError: webapp` when running `flask run`** — you're in the wrong folder. Run it from `~/workspace/LTR-Backend`, where `ls` shows the `webapp/` folder.
- **`KeyError: 'SECRET_KEY'` on startup** — your `.env` from [Lesson B0](B0-clean-slate-and-safety.md) is missing or in the wrong folder (must be the repo root). Re-check that lesson's Step 4.
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
