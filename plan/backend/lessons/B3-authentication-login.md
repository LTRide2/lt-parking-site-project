# Lesson B3 — Authentication (login)

> **Track:** Backend · **Lesson 4 of 10** (B0 → B9)
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first real feature, and three new ideas at once — signed tokens, password hashing, route guards — so go slow and read every line)
> **🧩 Prerequisites:** you've finished [Lesson B2 — Database schema & seed data](B2-database-schema-and-seed.md) — your PostgreSQL database exists, is migrated, and is seeded with an admin (`admin` / `admin123`) and at least one student code (`STU001`).
> **🌿 CR branch:** `cr/b3-auth` (off `cr/b2-schema`) · **📄 Source CR:** [CR B3](../backend-development-guide.md#cr-b3--authentication-login) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

> **New words ahead?** Terms like [JWT](GLOSSARY.md#jwt), [authentication](GLOSSARY.md#authentication), and [password hash](GLOSSARY.md#password-hash) link to the shared [**Glossary**](GLOSSARY.md) the first time each lesson uses them — one plain-language sentence per word. Click through whenever a word is new; you never have to memorize one before the lesson needs it.

## 🎯 Goal — what you'll have at the end

Right now anyone can hit your API, but nothing checks *who* they are. By the end of this hour, your backend will be able to answer "who is asking?" for every request. Concretely you will have:

- `webapp/App/db.py` — the **one** place that opens a connection to PostgreSQL; every other file borrows it from here.
- `webapp/App/auth.py` — a service that **issues** a signed login token ([JWT](GLOSSARY.md#jwt)) and **checks** one on every protected [request](GLOSSARY.md#request), plus a `@require_role` guard for admin-only routes.
- `webapp/App/views/auth.py` — four real [endpoints](GLOSSARY.md#endpoint): `POST /api/auth/student`, `POST /api/auth/admin`, `POST /api/auth/logout`, and `GET /api/auth/me`.

**🖼 Before → after — what the API does:**

```text
BEFORE  — no auth routes exist yet; every one is unhandled
  $ curl -i -X POST http://localhost:8000/api/auth/student -d '{"code":"STU001"}'
  HTTP/1.1 404 NOT FOUND
  {"error":{"code":"not_found","message":"Not found"}}

AFTER   — login issues a signed JWT; protected routes check it
  $ curl -i -X POST http://localhost:8000/api/auth/student \
    -H 'Content-Type: application/json' -d '{"code":"STU001"}'
  HTTP/1.1 200 OK
  {"data":{"token":"<jwt>","user":{"id":2,"role":"student","name":"Alice","email":"alice@lt.edu"}}}

  $ curl -i http://localhost:8000/api/auth/me
  HTTP/1.1 401 UNAUTHORIZED
  {"error":{"code":"unauthorized","message":"Login required"}}

  $ curl -i http://localhost:8000/api/auth/me -H "Authorization: Bearer <jwt>"
  HTTP/1.1 200 OK
  {"data":{"id":2,"role":"student","name":"Alice","email":"alice@lt.edu"}}
```

**✅ Done when (your deliverable checklist):**
- [ ] `webapp/App/db.py` exists with `get_db`, `close_db`, `query`, `query_one`, and `execute`; `close_db` is wired into `app.teardown_appcontext(...)` in `__init__.py`.
- [ ] `webapp/App/auth.py` exists with `issue_token`, `require_auth`, and `require_role`.
- [ ] `webapp/App/views/auth.py` exists with all three routes, and its blueprint is registered in `webapp/App/__init__.py`.
- [ ] `curl` with the seeded student code `STU001` returns `200` with a `token` and a `user`; an unknown code returns `401`.
- [ ] `curl /api/auth/me` **with** that token returns `200` with your user; **without** a token returns `401`.
- [ ] `curl -X POST /api/auth/logout` returns `204` with an empty body.
- [ ] Your work is committed on branch `cr/b3-auth` and pushed, PR base = `cr/b2-schema`.

---

## 🤔 Why this lesson matters

Every feature after this one — seeing lots, registering interest, an admin assigning a space — needs to know two things: *is someone logged in?* and *are they allowed to do this specific thing?* Without that, any stranger with your URL could book every parking space, or read every student's private data.

The pattern you're about to build — a server hands out a signed token at login, the browser sends that token back on every later request, the server checks the signature instead of re-checking a password every time — is the same pattern behind almost every "log in" button on the web. It's called **stateless [authentication](GLOSSARY.md#authentication)**: the server doesn't have to remember who's logged in; the proof travels *inside* the token itself. That's also why this is the first lesson where you write real "business logic" instead of setup — it's the foundation the other four backend lessons (B4–B7) all depend on.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **JWT (JSON Web Token)** | A signed, tamper-proof string that says "this is user X, and this token expires at time Y." | [jwt.io — Introduction to JSON Web Tokens](https://jwt.io/introduction) |
| **PyJWT** | The Python library that creates (`encode`) and checks (`decode`) JWTs. | [PyJWT documentation](https://pyjwt.readthedocs.io/) |
| **Password hashing (Werkzeug)** | Storing a one-way scrambled version of a password so even the database owner can't read the real one. | [Werkzeug: `werkzeug.security`](https://werkzeug.palletsprojects.com/en/stable/utils/#module-werkzeug.security) |
| **psycopg** | The Python library your app uses to talk to PostgreSQL. | [psycopg 3 documentation](https://www.psycopg.org/psycopg3/docs/) |
| **HTTP 401 vs 403** | 401 = "I don't know who you are"; 403 = "I know who you are, but you can't do that." | [MDN: 401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401) · [MDN: 403 Forbidden](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403) |
| **`Authorization: Bearer` header** | The standard way a client attaches its token to a request. | [MDN: `Authorization` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → `db.py` (10) → `auth.py` (15) → `views/auth.py` (15) → register the blueprint (5) → test & commit (10).

**Prerequisites:** B2's migration and seed data are applied (a real `users` table with an admin row and at least one student code), PostgreSQL is running, and your venv already has `PyJWT`, `psycopg[binary]`, and `Werkzeug` installed (they were added to `requirements.txt` back in B0).

**Branch off B2** — this CR is stacked on top of it, not on `main`:

```bash
git checkout cr/b2-schema
git checkout -b cr/b3-auth
```

**What this does & why:** you start from B2's branch (not `main`) because auth needs the `users` table B2 created — that's what "stacked CR" means: each lesson's branch carries forward the previous lesson's unmerged work. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — The database helper (~10 min)

Every route that needs the database will go through one shared helper instead of opening its own connection. Create `webapp/App/db.py`:

```python
# webapp/App/db.py
"""Database access: one connection per request, rows returned as dicts."""
import psycopg
from psycopg.rows import dict_row
from flask import g

from . import config


def get_db():
    """Return this request's DB connection, opening one if needed."""
    if "db" not in g:                                        # only the first call this request opens one
        g.db = psycopg.connect(config.DATABASE_URL, row_factory=dict_row)  # dict_row → rows come back as {"col": value}
    return g.db


def close_db(_e=None):
    """Close the connection at the end of the request (wired in __init__.py)."""
    db = g.pop("db", None)                       # remove from g, giving it back if one was opened
    if db is not None:
        db.close()


def query(sql, params=()):
    """Run a SELECT, return a list of dict rows."""
    with get_db().cursor() as cur:
        cur.execute(sql, params)                 # %s placeholders filled in safely from params
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
        row = cur.fetchone() if cur.description else None    # non-None only if SQL had RETURNING
    db.commit()
    return row
```

**Why it works & further reading:**
- **`psycopg`** speaks PostgreSQL's protocol; **`dict_row`** hands back each row as a dict like `{"id": 1, "name": "..."}` instead of a plain tuple, so the rest of your code can say `user["name"]`. → [psycopg 3 docs](https://www.psycopg.org/psycopg3/docs/)
- **`flask.g`** is a scratchpad Flask gives you that lives for exactly one request and is thrown away afterward — that's what makes `get_db()` open at most one connection per request. → [Flask: the `g` object](https://flask.palletsprojects.com/en/stable/appcontext/#storing-data)
- **`close_db()`** runs automatically at the end of every request once wired into `teardown_appcontext` below, so connections never leak.
- **`query`/`query_one`/`execute`** — psycopg fills the `%s` placeholders in from `params`, which is how you avoid SQL-injection bugs; `execute` commits and returns a row only when the SQL ends in `RETURNING ...`.

Now wire `close_db` into the app so it actually runs after every request. In `webapp/App/__init__.py`, inside `create_app()`, add this right after the `CORS(...)` line:

```python
    from . import db
    app.teardown_appcontext(db.close_db)         # call close_db when the request ends, success or failure
```

**Why it works & further reading:**
- **`teardown_appcontext`** guarantees `close_db` runs even if your route crashes partway through. → [Flask: `teardown_appcontext`](https://flask.palletsprojects.com/en/stable/api/#flask.Flask.teardown_appcontext)

### Step 2 — The auth service: tokens + password checking (~15 min)

This is the file that knows how to **prove** someone is logged in. Create `webapp/App/auth.py`:

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
    payload = {                                  # the claims this JWT carries
        "user_id": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXP_HOURS),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")  # sign it with SECRET_KEY


def _current_user():
    """Read the Bearer token, verify it, and load the user. None if invalid."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):         # no/wrong-shaped header → no user
        return None
    token = header.split(" ", 1)[1]              # everything after "Bearer "
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=["HS256"])  # re-checks the signature
    except jwt.PyJWTError:                       # forged, expired, or corrupted
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
        g.user = user                            # route function reads the caller off g.user
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
            if user["role"] != role:              # logged in, but the wrong role
                return _error("forbidden", f"{role} only", 403)
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator
```

**Why it works & further reading:**
- **`issue_token(user)`** — the payload carries which user, which [role](GLOSSARY.md#role), and when it expires; only whoever holds `SECRET_KEY` can produce a matching signature, which is what makes a JWT tamper-proof even though anyone can read its contents. → [jwt.io — how JWTs work](https://jwt.io/introduction) · [PyJWT: `encode`](https://pyjwt.readthedocs.io/en/stable/api.html#jwt.encode)
- **`_current_user()`** — parses the `Authorization` header, then `jwt.decode` re-checks the signature with the same secret key; a forged, expired, or corrupted token raises `jwt.PyJWTError` instead of crashing. → [MDN: `Authorization` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) · [PyJWT: `decode`](https://pyjwt.readthedocs.io/en/stable/api.html#jwt.decode)
- **`_error(code, message, status)`** builds the same `{"error": {...}}` [envelope](GLOSSARY.md#envelope) B1 introduced, so every auth failure looks the same to the frontend.
- **`require_auth`** — a **[decorator](GLOSSARY.md#decorator)** for "someone logged in, don't care who"; no user → `401` (MDN: "I don't know who you are"). → [MDN: 401](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401)
- **`require_role("admin")`** — like `require_auth`, but also checks the user's role; the wrong role → `403` (MDN: "I know who you are, but no"). → [MDN: 403](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403)
- **`@wraps(fn)`** keeps the wrapped function's name/docstring intact so Flask's routing doesn't get confused about which function is which. → [`functools.wraps` docs](https://docs.python.org/3/library/functools.html#functools.wraps)

> **Why 401 for "no token" but also 401 for "wrong password"?** Both mean "I can't verify who you are" — the spec (and this codebase) reserves `403` specifically for "I verified you, but you're not allowed." Keeping that distinction consistent is what lets a future frontend show the right message ("please log in" vs. "you don't have access").

### Step 3 — The login & `/me` routes (~15 min)

Now the actual endpoints people call. Create `webapp/App/views/auth.py`:

```python
# webapp/App/views/auth.py
from flask import Blueprint, request, jsonify, g
from werkzeug.security import check_password_hash

from ..db import query_one
from ..auth import issue_token, require_auth

bp = Blueprint("auth", __name__)                 # groups these four routes; registered in __init__.py


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _public_user(user):
    """Response-safe fields for login/me — never the password_hash."""
    return {"id": user["id"], "role": user["role"], "name": user["name"], "email": user["email"]}


@bp.post("/api/auth/student")
def student_login():
    body = request.get_json(silent=True) or {}
    code = body.get("code")
    if not code:
        return _err("bad_request", "code is required", 400)
    user = query_one(                            # the code itself is the credential — no password
        "SELECT id, role, name, email FROM users WHERE role='student' AND code = %s", (code,))
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
        "SELECT id, role, name, email, password_hash FROM users "
        "WHERE role='admin' AND username = %s", (username,))
    if user is None or not check_password_hash(user["password_hash"], password):  # re-hash & compare
        return _err("unauthorized", "Bad credentials", 401)
    return jsonify({"data": {"token": issue_token(user), "user": _public_user(user)}})


@bp.post("/api/auth/logout")
def logout():
    # Tokens are stateless, so the client just discards it. 204 = "done, no body".
    return "", 204


@bp.get("/api/auth/me")
@require_auth                                    # runs first; g.user is set by the time me() runs
def me():
    return jsonify({"data": _public_user(g.user)})
```

> **Looking ahead:** B4 pulls `_public_user` (and the lot/space serializers it introduces) into a shared `webapp/App/serialize.py`, so `student_login`, `admin_login`, and `me` all end up calling `serialize.public_user(user)` instead of a local helper. The shape — `{id, role, name, email}` — doesn't change.

**Why it works & further reading:**
- **`Blueprint("auth", __name__)`** groups these routes as one unit, the same pattern the health check used in B1. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/)
- **`student_login()`** — a single unhashed lookup; student "login" is just knowing the code, not a password. No match → `401`.
- **`admin_login()`** — the database never stores the real password, only a one-way **[password hash](GLOSSARY.md#password-hash)** created back in B2's seed data; `check_password_hash` re-hashes the submitted password the same way and compares. → [Werkzeug: `check_password_hash`](https://werkzeug.palletsprojects.com/en/stable/utils/#werkzeug.security.check_password_hash)
- **`logout()`** — JWTs are stateless, so there's nothing to erase server-side; the endpoint exists for the frontend to call and returns `204 No Content`.
- **`me()`** — `@require_auth` runs first, so `g.user` is guaranteed set by the time `me()` reshapes it with `_public_user`.
- **`_public_user(user)`** — every auth [response](GLOSSARY.md#response) now includes `email`, but never `password_hash`, so a hash never leaves the server.

### Step 4 — Register the blueprint (~5 min)

In `webapp/App/__init__.py`, next to where you registered `health` in B1, add:

```python
    from .views import auth
    app.register_blueprint(auth.bp)              # turns the routes above into live URLs
```

**Why it works & further reading:**
- **`app.register_blueprint(auth.bp)`** is what actually turns the routes you just wrote into live URLs; without it, `views/auth.py` would just be a file that exists but nothing would ever call it.

---

## 🧪 Prove it works — testing guide

**Setup:** DB seeded (B2) and `flask run --port 8000` running.

**macOS / Linux**

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

**Windows (PowerShell)**

```powershell
# valid student
Invoke-RestMethod -Method Post http://localhost:8000/api/auth/student `
  -ContentType application/json -Body '{"code":"STU001"}'
# invalid student
Invoke-RestMethod -Method Post http://localhost:8000/api/auth/student `
  -ContentType application/json -Body '{"code":"NOPE"}'
# admin (password from B2 seed)
Invoke-RestMethod -Method Post http://localhost:8000/api/auth/admin `
  -ContentType application/json -Body '{"username":"admin","password":"admin123"}'
```

Copy the `token` value from a successful response, then:

**macOS / Linux**

```bash
curl -i http://localhost:8000/api/auth/me -H "Authorization: Bearer <paste-token>"
curl -i http://localhost:8000/api/auth/me     # no token
curl -i -X POST http://localhost:8000/api/auth/logout   # stateless: always 204
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod http://localhost:8000/api/auth/me -Headers @{Authorization="Bearer <paste-token>"}
Invoke-RestMethod http://localhost:8000/api/auth/me     # no token
Invoke-RestMethod -Method Post http://localhost:8000/api/auth/logout   # stateless: always 204
```

**What you should see:**
- Valid student (`STU001` seeds to Alice) → `200` with `{"data":{"token":"...","user":{"id":2,"role":"student","name":"Alice","email":"alice@lt.edu"}}}` — `user` always includes `email` now.
- Valid admin → `200` with the same shape: `{"data":{"token":"...","user":{"id":1,"role":"admin","name":"Admin","email":"admin@lt.edu"}}}`.
- Wrong code / wrong password → `401` `{"error":{"code":"unauthorized",...}}`.
- `/me` with token → `200` `{"data":{"id":2,"role":"student","name":"Alice","email":"alice@lt.edu"}}`; `/me` without token → `401`.
- `logout` → `204` with an empty body. Tokens are stateless, so there's nothing to invalidate server-side — the client just discards the token; the endpoint always succeeds.

**☁️ Cloud check (optional):** after `./release.sh backend`, repeat the login against the server (the seed must have been run on RDS — see B2's cloud check):

**macOS / Linux**

```bash
curl -i -X POST http://<ElasticIp>/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}'
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod -Method Post http://<ElasticIp>/api/auth/student `
  -ContentType application/json -Body '{"code":"STU001"}'
```

Expect `200` with a token. A `500` here usually means `SECRET_KEY`/`DATABASE_URL` aren't set in the server's `.env` (Part 3).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B3: db helper, JWT auth service, student/admin login + /me"
git push -u origin cr/b3-auth
```

Then open a Pull Request on GitHub with **base = `cr/b2-schema`** (not `main` — this CR is stacked on B2 and hasn't merged yet). Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`401` on a code/password you're sure is right** — double-check it's *exactly* the seeded value (`STU001`, `admin`/`admin123`, case-sensitive), and that B2's migration + seed actually ran against the database `DATABASE_URL` points at.
- **`ModuleNotFoundError: No module named 'jwt'` (or `'psycopg'`, `'werkzeug'`)** — your venv isn't active, or B0's `pip install -r webapp/requirements.txt` didn't pick these up. Confirm `(.venv)` is in your prompt and re-run it.
- **`/me` returns `401` even with a token pasted in** — the header must be exactly `Authorization: Bearer <token>` with one space after `Bearer` and no quotes around the token itself.
- **`500 Internal Server Error` on any auth route** — usually a missing `SECRET_KEY`/`DATABASE_URL` (check `.env` from B0) or PostgreSQL not running (see B2's "installing and starting PostgreSQL" box).
- **`connection refused` from psycopg** — PostgreSQL isn't started, or `DATABASE_URL` in `.env` points at the wrong database name/port.

---

## 📝 Recap — what you built and learned

- You built the **one shared database helper** (`db.py`) every future route will reuse, with connections opened and closed automatically per request.
- You built a **JWT-based auth service** that issues signed tokens and verifies them on every protected request — no server-side "session" to manage.
- You learned the **stateless auth pattern**: the token itself carries proof of identity, checked by signature, not by looking anything up in a session store.
- You learned why passwords are never stored in plain text, and how `check_password_hash` verifies one without ever un-hashing it.
- You added the first two authorization primitives (`require_auth`, `require_role`) that every remaining lesson (B4–B7) will reuse to protect its own routes.
- You shaped every auth response through one `_public_user` helper (`{id, role, name, email}`) instead of hand-building each dict — the seed of the pattern B4 promotes into `webapp/App/serialize.py`.

---

## 📚 References

- [jwt.io — Introduction to JSON Web Tokens](https://jwt.io/introduction) — how a JWT is structured and signed.
- [PyJWT documentation](https://pyjwt.readthedocs.io/) — `encode`/`decode` API used in `auth.py`.
- [Werkzeug: `werkzeug.security`](https://werkzeug.palletsprojects.com/en/stable/utils/#module-werkzeug.security) — `check_password_hash` and password hashing.
- [psycopg 3 documentation](https://www.psycopg.org/psycopg3/docs/) — the PostgreSQL driver used in `db.py`.
- [MDN: 401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401) and [MDN: 403 Forbidden](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403).
- [MDN: `Authorization` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization).
- [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) and [Flask: `teardown_appcontext`](https://flask.palletsprojects.com/en/stable/api/#flask.Flask.teardown_appcontext).
- Source of truth for this lesson: [backend guide → CR B3](../backend-development-guide.md#cr-b3--authentication-login).

---

## ➡️ Next lesson

**[Lesson B4 — Read lots & spaces](B4-read-lots-and-spaces.md).** You'll add the first data-reading endpoints (`GET /api/lots`, `GET /api/lots/<id>/spaces`) and reuse the `require_auth` guard you just built. → [source CR](../backend-development-guide.md#cr-b4--read-lots--spaces).
