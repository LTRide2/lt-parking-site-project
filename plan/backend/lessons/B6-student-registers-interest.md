# Lesson B6 — Student registers interest

> **Track:** Backend · **Lesson 7 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first "prevent a duplicate" rule, enforced in two places at once)
> **🧩 Prerequisites:** [Lesson B5 — Admin enables/disables spaces](B5-admin-enable-disable-spaces.md).
> **🌿 CR branch:** `cr/b6-interest` (off `cr/b5-spaces`) · **📄 Source CR:** [backend guide → CR B6](../backend-development-guide.md#cr-b6--student-registers-interest) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

A backend feature that lets a **student say "I want a parking spot"** — and stops them from saying it twice while their first request is still waiting. Concretely, by the end of this hour you will have:

- `POST /api/interest` — a student creates a `pending` interest request, optionally naming a preferred lot.
- A duplicate-request guard: a student who already has a `pending` request gets a `409 Conflict`, not a second row.
- `GET /api/interest/me` — a student sees their own requests.
- `GET /api/interest` — an admin sees *everyone's* requests, with an optional `?status=` filter.

**✅ Done when (your deliverable checklist):**
- [ ] `POST /api/interest` as a student returns `201` with a `pending` request the first time.
- [ ] The *same* student POSTing again returns `409` with `"You already have an active request"` — no second row is created.
- [ ] `GET /api/interest/me` (student) shows only that student's own requests.
- [ ] `GET /api/interest?status=pending` (admin) shows the request with the student's name and code attached.
- [ ] An admin hitting `POST /api/interest` gets `403`; a student hitting `GET /api/interest` gets `403`.
- [ ] Your work is committed on branch `cr/b6-interest` and pushed, PR base = `cr/b5-spaces`.

---

## 🤔 Why this lesson matters

Up to now, every endpoint you've built either *reads* data (B4) or is toggled by an *admin* (B5). This lesson is the first time a **student writes something into the database themselves** — and the first time you have to stop the same user from doing it twice by accident (a double-click, a slow network retry, a second browser tab).

The naive fix — "just check in Python before inserting" — has a bug: two requests can both pass the check *at the same instant*, before either has inserted its row, and you end up with two `pending` rows anyway. This is a **race condition**. The fix you'll use here is the professional one: check in Python for a friendly error message, **and** let the database enforce the rule with a unique index, so it is *structurally impossible* to end up with two active requests no matter what the Python code does or how many requests arrive at once. You already created that index back in B2 (`one_active_interest_per_user`) — this lesson is where you finally rely on it.

You'll also write your first endpoint with **three different access rules on three routes in the same file** — student-only, student-only, and admin-only — which is exactly the shape most real APIs take: the same resource (`interest`), different views and permissions depending on who's asking.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **HTTP POST** | The method for *creating* something new on the server. | [MDN: HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST) |
| **REST "create" pattern** | POST to a collection URL (`/api/interest`) creates one new item and returns it with `201`. | [MDN: HTTP response status codes — 201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/201) |
| **SQL `INSERT`** | The statement that adds a new row to a table. | [PostgreSQL docs: INSERT](https://www.postgresql.org/docs/current/sql-insert.html) |
| **Unique constraint / preventing duplicate rows** | A rule the *database* enforces so two rows can never both satisfy a condition — even under a race. | [PostgreSQL docs: Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html) |
| **Request body JSON parsing in Flask** | Reading the JSON a client sent in a `POST` body as a Python dict. | [Flask docs: `Request.get_json`](https://flask.palletsprojects.com/en/stable/api/#flask.Request.get_json) |

---

## ✅ Before you start

**Prerequisites:** you've finished [Lesson B5 — Admin enables/disables spaces](B5-admin-enable-disable-spaces.md) — this lesson branches off B5's branch, so `interest`'s parent table dependencies (`users`, `lots`) and the `require_role` decorator already exist. You'll also lean on the `interest` table and its `one_active_interest_per_user` unique index, both created back in B2.

**Time budget for the hour:** branch (5 min) → write `views/interest.py` (25) → register the blueprint (5) → local testing (15) → commit (10).

**Open your terminal, activate the virtual environment, and make your branch** — off `cr/b5-spaces`, not `main` (this is a stacked CR):

```bash
git checkout cr/b5-spaces
git checkout -b cr/b6-interest
```

---

## 🛠 Build it, step by step

### Step 1 — Write the interest endpoints (~25 min)

Create `webapp/App/views/interest.py`:

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

**Explanation, piece by piece:**
- `@bp.post("/api/interest")` — registers this function to handle `POST` requests to that URL. POST is the HTTP method for *creating* a new resource. → [MDN: HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST).
- `@require_role("student")` — the decorator from B3's auth module; it runs before the view and returns `403` if the caller isn't logged in as a student. Stacking it under `@bp.post(...)` means "only a student may create an interest."
- `body = request.get_json(silent=True) or {}` — reads the JSON the client sent in the request body into a Python dict. `silent=True` means "don't crash on bad/missing JSON, just return `None`"; the `or {}` then falls back to an empty dict so `body.get("lotId")` never blows up. → [Flask docs: `Request.get_json`](https://flask.palletsprojects.com/en/stable/api/#flask.Request.get_json).
- `lot_id = body.get("lotId")` — `.get()` on a dict returns `None` if the key is missing, which is fine here: `lotId` is optional (the student's *preferred* lot, not a requirement).
- **The duplicate check, in two layers:**
  1. `existing = query_one("SELECT id FROM interest WHERE user_id = %s AND status='pending'", ...)` — first, ask nicely: "does this student already have a pending request?" If yes, return a friendly `409` before even trying to insert.
  2. `except psycopg.errors.UniqueViolation:` — but layer 1 has a gap: two requests from the same student could both pass that `SELECT` at nearly the same instant, before either has inserted. So the `INSERT` is wrapped in a `try`/`except` that catches the *database* rejecting a genuine duplicate — the `one_active_interest_per_user` unique index from B2 is what actually throws this. → [PostgreSQL docs: Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html).
  This is "defense in depth": the Python check gives a fast, friendly error in the common case; the database index is the rule that can never be bypassed, race or no race.
- `execute(... RETURNING id, user_id, lot_id, status, created_at)` — `RETURNING` on an `INSERT` hands back the row you just created (including the auto-generated `id` and `created_at`) in the same round trip, so you don't need a second query to read it back. → [PostgreSQL docs: INSERT](https://www.postgresql.org/docs/current/sql-insert.html).
- `return jsonify({"data": {...}}), 201` — `201 Created` is the correct status code for "I made a new thing," as opposed to `200 OK` for a plain read. → [MDN: 201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/201).
- `my_interest()` — a student's own view: filtered to `user_id = g.user["id"]`, so a student can never see anyone else's requests just by knowing this endpoint exists.
- `list_interest()` — the admin's view: no `user_id` filter (admins see everyone), an optional `?status=` query filter, and a `JOIN` against `users` so the response includes *who* made each request (name + code), which the plain student view has no need for.

### Step 2 — Register the blueprint (~5 min)

Open `webapp/App/__init__.py` and register it alongside the other blueprints:

```python
    from .views import interest
    app.register_blueprint(interest.bp)
```

**Why this line matters:** a Blueprint is just a bundle of routes until the app registers it — without this line, Flask has no idea `/api/interest` exists, no matter how correct `interest.py` is.

---

## 🧪 Prove it works — testing guide

**Setup:** server running (`flask run` or however B1 set it up); `$S` = a student's login token, `$A` = an admin's login token (from B3's login endpoint).

**Steps:**
```bash
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1}'
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1}'  # again
curl -s http://localhost:8000/api/interest/me -H "Authorization: Bearer $S"
curl -s "http://localhost:8000/api/interest?status=pending" -H "Authorization: Bearer $A"
```

**What you should see:**
- First POST → `201` with a `pending` request.
- Second POST → `409` (`"You already have an active request"`).
- `/interest/me` (student) shows the one request.
- `/interest?status=pending` (admin) shows it with the student's name + code attached.
- An admin hitting `POST /api/interest` → `403`; a student hitting `GET /api/interest` → `403`. (Try both to confirm the role guard on each route.)

**☁️ Cloud check (optional):** after `./release.sh backend`, POST an interest to `http://<ElasticIp>/api/interest` with a server student token, then read it back with `/api/interest/me`. This is the backend half of the full E2E flow in **Part 1E** of the backend guide — running it in the cloud means UI CR **U5** can be tested against the live server too.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B6: student interest register + list (self/admin)"
git push -u origin cr/b6-interest
```

Then open a Pull Request on GitHub with **base = `cr/b5-spaces`** (this CR stacks on B5, not `main`). Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Second POST returns `201` instead of `409`** — check that migration B2 actually created `one_active_interest_per_user` (`\d interest` in `psql` should list it) and that you didn't accidentally query/insert with a different `status` value than `'pending'`.
- **`psycopg.errors.UniqueViolation` isn't caught / the request 500s** — confirm the `import psycopg` line is present and the `except` clause matches exactly `psycopg.errors.UniqueViolation` (a typo here lets the real database error escape as a `500`).
- **`GET /api/interest/me` shows requests from other students** — you likely dropped the `WHERE user_id = %s` filter or passed the wrong value; re-check `g.user["id"]` is being used, not something like `request.args.get("userId")`.
- **Every request returns `403`** — your `$S`/`$A` token may have expired (B3's tokens expire) or you copied the token without the `Bearer ` prefix. Re-login and retry.
- **`lotId` always comes back `null`** — double-check the request body is valid JSON and the header `Content-Type: application/json` is set; without it Flask may not parse the body at all.

---

## 📝 Recap

- You built your first **student-writable** endpoint — `POST /api/interest` — and the two role-scoped read endpoints that go with it (`/me` for the student, the bare collection for the admin).
- You learned to defend against a **race condition** with two layers: a friendly Python pre-check, and a database unique index as the rule that can never be bypassed.
- You used SQL's `RETURNING` clause to read back a freshly inserted row in one round trip.
- You saw the same resource (`interest`) exposed through three routes with three different access rules — the shape most real REST APIs take.

---

## 📚 References

- [MDN: HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST) — the method for creating resources.
- [MDN: 201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/201) — the correct status for a successful creation.
- [PostgreSQL docs: INSERT](https://www.postgresql.org/docs/current/sql-insert.html) — including `RETURNING`.
- [PostgreSQL docs: Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html) — how the database prevents duplicate rows even under a race.
- [Flask docs: `Request.get_json`](https://flask.palletsprojects.com/en/stable/api/#flask.Request.get_json) — parsing a JSON request body.
- Source of truth for this lesson: [backend guide → CR B6](../backend-development-guide.md#cr-b6--student-registers-interest).

---

## ➡️ Next lesson

**[Lesson B7 — Admin assigns a space](B7-admin-assigns-a-space.md).** You'll close the loop: an admin turns a `pending` interest into an actual space assignment. → [source CR](../backend-development-guide.md#cr-b7--admin-assigns-a-space).
