# Lesson B4 — Read lots & spaces

> **Track:** Backend · **Lesson 5 of 10** (B0 → B9)
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first real database query with a `JOIN` and a count — but every later endpoint reuses this same shape)
> **🧩 Prerequisites:** you've finished [Lesson B3 — Authentication (login)](B3-authentication-login.md) — the server runs, the database is seeded, and you can log in and get a token.
> **🌿 CR branch:** `cr/b4-lots` (off `cr/b3-auth`) · **📄 Source CR:** [backend guide → CR B4](../backend-development-guide.md#cr-b4--read-lots--spaces) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

> **New words ahead?** Terms like [endpoint](GLOSSARY.md#endpoint), [serialization](GLOSSARY.md#serialization), and [foreign key](GLOSSARY.md#foreign-key) link to the shared [**Glossary**](GLOSSARY.md) the first time each lesson uses them — one plain-language sentence per word. Click through whenever a word is new; you never have to memorize one before the lesson needs it.

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

The first [endpoints](GLOSSARY.md#endpoint) that actually **read real data out of the database** and hand it to whoever is logged in. Concretely, by the end of this hour you will have:

- `backend/webapp/App/serialize.py` — a shared module holding the SQL fragment and the functions that turn a lot/space row into the exact JSON shape the frontend expects, so every view that touches lots or spaces reads from one place instead of re-inventing the shape.
- `GET /api/lots` — returns every parking lot, each with a `capacity` (total spaces) and an `available_count` (spaces still free), computed by the database in one query.
- `GET /api/lots/:id/spaces` — returns every space inside one specific lot as a bare array, or a `404` if that lot doesn't exist.
- Both [routes](GLOSSARY.md#route) protected by the `@require_auth` guard you built in B3 — no token, no data.

**🖼 Before → after — what the API does:**

```text
BEFORE  — no lots endpoint is registered yet
  $ curl -i http://localhost:8000/api/lots -H "Authorization: Bearer $T"
  HTTP/1.1 404 NOT FOUND
  {"error":{"code":"not_found","message":"Not found"}}

AFTER   — real lots and spaces, straight from the database
  $ curl -i http://localhost:8000/api/lots -H "Authorization: Bearer $T"
  HTTP/1.1 200 OK
  {"data":[{"id":1,"name":"Lot 1","number":1,"display_order":1,"map_image_url":"/lots/lot1.jpg","capacity":8,"available_count":6}, ...]}

  $ curl -i http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $T"
  HTTP/1.1 200 OK
  {"data":[{"id":1,"lot_id":1,"label":"A1","status":"available", ...}, {"id":8,"lot_id":1,"label":"A8","status":"assigned","assigned_user_name":"Alice","rotation":90, ...}]}
```

**✅ Done when (your deliverable checklist):**
- [ ] `curl .../api/lots -H "Authorization: Bearer $T"` → `200` with Lot 1 (`number` 1, `capacity` 8, `available_count` 6, since A4 is disabled and A8 is assigned) plus the other five seeded lots.
- [ ] `curl .../api/lots/1/spaces -H "Authorization: Bearer $T"` → `200` with a bare array of 8 spaces (`A1`..`A8`); `A8` has `"status": "assigned"`, `"assigned_user_name": "Alice"`, `"rotation": 90`.
- [ ] `curl .../api/lots/999/spaces -H "Authorization: Bearer $T"` → `404`.
- [ ] `curl .../api/lots` with **no** token → `401`.
- [ ] Your work is committed on branch `cr/b4-lots` and pushed, PR base = `cr/b3-auth`.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

Every lesson so far has been *plumbing*: B0 made secrets safe, B1 proved the server runs, B2 built the tables, B3 proved who's asking. None of it returned anything a user actually cares about. This lesson is the turning point — it's the first feature the frontend can put on a screen: a list of parking lots and how full they are.

It's also a template. Look closely and you'll notice the shape repeats for the rest of the backend: check who's logged in (`@require_auth`), ask the database a question (`query` / `query_one`), reshape the rows into the JSON the frontend expects, wrap them in `{"data": ...}`. Lessons B5–B7 (enabling spaces, registering interest, assigning a space) are all this same recipe with a different SQL statement in the middle. Get comfortable with it here and the rest goes faster.

There's one more idea worth calling out: the `capacity`/`available_count` numbers are computed **by the database**, in the same query that fetches the lots — not by fetching every space separately and counting them in Python. One well-written SQL query beats a loop of small ones; it's faster and it's the pattern professional backends use whenever they can.

And a third idea, new to this lesson: this is also the first CR to reshape a row that more than one view module will need — spaces get read here, but they'll also get read (and rewritten) in B8's layout editor and later in assignments. Rather than let each view module invent its own `{...}` dict for a space, B4 introduces `backend/webapp/App/serialize.py`: one shared SELECT and one shared shape-function per resource. Every later lesson imports it instead of re-deriving the shape, so the API can't drift out from under the frontend one view at a time.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Flask Blueprint** | A Python file holding a group of related routes, registered once with the app. | [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) |
| **Flask routing** | The `@bp.get("/api/lots")` decorator maps one URL + HTTP method to one Python function. | [Flask Quickstart: Routing](https://flask.palletsprojects.com/en/stable/quickstart/#routing) |
| **REST `GET`** | The HTTP method that means "read this resource — never change anything." | [MDN: GET method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) |
| **JSON response (`jsonify`)** | Turns a Python `dict`/`list` into a proper HTTP response with a JSON body and the right headers. | [Flask API: `jsonify`](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify) |
| **SQL `SELECT` / `JOIN`** | `SELECT` reads rows; a `JOIN` combines two tables through a shared key so you can count spaces per lot in one trip to the database. | [Postgres: `SELECT`](https://www.postgresql.org/docs/current/sql-select.html) · [Postgres: Table joins](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) |
| **URL path parameter** | The `<int:lot_id>` part of a route captures a piece of the URL and hands it to your function as an argument. | [Flask Quickstart: Variable Rules](https://flask.palletsprojects.com/en/stable/quickstart/#variable-rules) |
| **psycopg query params (`%s`)** | `%s` placeholders let psycopg safely substitute a Python value into SQL, instead of pasting text into the query string. | [psycopg3: Passing parameters](https://www.psycopg.org/psycopg3/docs/basic/params.html) |
| **Shared serializer module** | One file (`serialize.py`) that owns the SQL SELECT and the row→JSON shape for a resource, so every view importing it produces the exact same fields. | [Wikipedia: Don't repeat yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → build `serialize.py` (15) → build `list_lots` + `lot_spaces` (20) → register the blueprint (5) → test & commit (15).

**Open your terminal, activate the virtual environment, and make your branch.** B4 stacks on top of B3 — it needs the auth guard and the database helper you already built:

**macOS / Linux**

```bash
source backend/.venv/bin/activate  # your prompt should start with (.venv)
git checkout cr/b3-auth
git checkout -b cr/b4-lots      # create + switch to this lesson's branch
```

**Windows (PowerShell)**

```powershell
backend\.venv\Scripts\Activate.ps1  # your prompt should start with (.venv)
                                # blocked by execution policy? run once: Set-ExecutionPolicy -Scope Process RemoteSigned
git checkout cr/b3-auth
git checkout -b cr/b4-lots      # create + switch to this lesson's branch
```

**What this does & why:** because `cr/b4-lots` branches off `cr/b3-auth` (not `main`), it inherits everything B0–B3 built — `.env`, the schema, the login endpoints — so you only have to write the two new routes below. This is the **stacked-CR** pattern the whole project follows. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Create `backend/webapp/App/serialize.py` (~15 min)

Before writing the first view, create the module every lot/space (and later, interest/student) view will import instead of shaping its own JSON:

```python
# backend/webapp/App/serialize.py
"""Turn database rows into the exact JSON shapes the frontend slices consume."""

# Shared SELECT so every view reads a space the same way. Callers append their
# own WHERE/ORDER BY and pass the rows straight to space().
# LEFT JOINs keep the space even if unassigned; COALESCE below picks whichever
# join (login user or roster-only student) actually matched.
SPACE_SELECT = """
    SELECT s.id, s.lot_id, s.label, s.status,
           s.assigned_user_id, s.assigned_student_id,
           s.pos_x, s.pos_y, s.pos_w, s.pos_h, s.rotation,
           COALESCE(u.name, st.first || ' ' || st.last) AS assigned_user_name
    FROM spaces s
    LEFT JOIN users u ON u.id = s.assigned_user_id
    LEFT JOIN students st ON st.student_id = s.assigned_student_id
"""


def lot(row):
    """A lot with its live capacity/availability counts."""
    return {
        "id": row["id"],
        "name": row["name"],
        "number": row["number"],
        "display_order": row["display_order"],
        "map_image_url": row["map_image_url"],
        "capacity": row["capacity"],                  # from the SQL's count(s.id) alias
        "available_count": row["available_count"],    # from the SQL's FILTERed count alias
    }


def space(row):
    """A parking space; positions/size are normalized fractions (NULL if unset)."""
    return {
        "id": row["id"],
        "lot_id": row["lot_id"],
        "label": row["label"],
        "status": row["status"],
        "x": row["pos_x"],           # renamed: DB says pos_x, the map frontend calls it x
        "y": row["pos_y"],
        "w": row["pos_w"],
        "h": row["pos_h"],
        "rotation": row["rotation"],
        "assigned_user_id": row["assigned_user_id"],
        "assigned_user_name": row.get("assigned_user_name"),  # .get(): only present on SPACE_SELECT rows
        "assigned_student_id": row["assigned_student_id"],
    }
```

**Why it works & further reading:**
- **A shared [serialization](GLOSSARY.md#serialization) point:** a space gets read here, then rewritten by B8's layout editor and read again by later assignment endpoints — one shared shape-function means none of those views can invent a differently-spelled JSON dict. → [Wikipedia: Don't repeat yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- `SPACE_SELECT` is a SQL *fragment*, not a full query — it has no `WHERE`/`ORDER BY`; callers append those and run it through `query()`/`query_one()`. Its `LEFT JOIN`s follow the [foreign key](GLOSSARY.md#foreign-key)s `assigned_user_id`/`assigned_student_id`, and `COALESCE` picks whichever join actually matched. → [Postgres: `COALESCE`](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-COALESCE)
- `lot()` and `space()` translate rows into the frontend's own field names — almost every key already matches the database column. The one deliberate rename is `space()`'s `x`/`y`/`w`/`h`: "position" is a DB detail, but `x`/`y`/`w`/`h` is what the map-rendering frontend calls them.
- `row.get("assigned_user_name")` uses `.get` (not `row["..."]`) defensively, because that column only exists on rows built from `SPACE_SELECT`.

### Step 2 — Create `backend/webapp/App/views/lots.py` (~20 min)

Create the file:

```python
# backend/webapp/App/views/lots.py
from flask import Blueprint, jsonify

from ..db import query, query_one            # B3's database helpers
from ..auth import require_auth              # B3's login guard
from .. import serialize                     # the row->JSON shapes from Step 1

bp = Blueprint("lots", __name__)


def _err(code, message, status):             # tiny helper: same {"error": {...}} shape everywhere
    return jsonify({"error": {"code": code, "message": message}}), status


@bp.get("/api/lots")                          # decorator: run this function for GET /api/lots
@require_auth                                 # runs first (bottom-up) — no token, no query
def list_lots():
    rows = query("""
        SELECT l.id, l.name, l.number, l.display_order, l.map_image_url,
               count(s.id)                                     AS capacity,
               count(s.id) FILTER (WHERE s.status='available') AS available_count
        FROM lots l
        LEFT JOIN spaces s ON s.lot_id = l.id  -- keep a lot even with zero spaces
        GROUP BY l.id
        ORDER BY l.display_order, l.id
    """)
    return jsonify({"data": [serialize.lot(row) for row in rows]})  # the {"data": ...} envelope
```

**Why it works & further reading:**
- Reuses B3's database helper, login guard, and the `serialize` module from Step 1 — nothing here reinvents them. → [Python: Relative imports](https://docs.python.org/3/reference/import.html#package-relative-imports)
- `_err(...)` builds the standard `{"error": {...}}` [envelope](GLOSSARY.md#envelope), so every error return in this file (and the write routes B8/B9 add later) is one short line instead of a repeated `jsonify({...}), status`.
- `@bp.get("/api/lots")` is the route; `@require_auth` sits directly under it because [decorator](GLOSSARY.md#decorator)s apply bottom-up — the token check runs *before* Flask ever calls `list_lots`. → [Flask Quickstart: Routing](https://flask.palletsprojects.com/en/stable/quickstart/#routing)
- `LEFT JOIN` keeps a lot even with zero spaces (a plain `JOIN` would drop it); `FILTER (WHERE ...)` lets one `count()` compute `capacity` and `available_count` in a single trip to the database. → [Postgres: Table joins](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · [Postgres: Aggregate expressions (`FILTER`)](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES)
- `serialize.lot(row)` does the row→JSON translation — the SQL's aliases already match what it expects, so there's nothing left for this view to do.

Now add the second route, in the same file:

```python
def _lot_spaces(lot_id):
    """Every space in a lot, serialized, ordered by id."""
    rows = query(serialize.SPACE_SELECT + " WHERE s.lot_id = %s ORDER BY s.id", (lot_id,))  # %s: safe placeholder
    return [serialize.space(row) for row in rows]


@bp.get("/api/lots/<int:lot_id>/spaces")      # <int:lot_id> captures the URL segment as a Python int
@require_auth
def lot_spaces(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:  # exists check, before fetching spaces
        return _err("not_found", "Lot not found", 404)                    # clean 404, not an empty/misleading list
    return jsonify({"data": _lot_spaces(lot_id)})                         # bare array under "data" — no extra wrapper
```

**Why it works & further reading:**
- `<int:lot_id>` captures whatever number is in that URL position and hands it to `lot_spaces` as an argument — visit `/api/lots/1/spaces` and `lot_id` is `1`. → [Flask Quickstart: Variable Rules](https://flask.palletsprojects.com/en/stable/quickstart/#variable-rules)
- `%s` + a parameter tuple lets psycopg substitute `lot_id` *safely* — never build SQL by pasting a variable into a string. → [psycopg3: Passing parameters](https://www.psycopg.org/psycopg3/docs/basic/params.html)
- Checking the lot exists *before* fetching its spaces turns a bad id into a clean `404` [status code](GLOSSARY.md#status-code) instead of an empty, misleading list; `_err` builds the same error shape used everywhere else in the API.
- `_lot_spaces(lot_id)` is its own helper because B8's layout editor needs this exact "fetch + serialize every space in a lot" step too — one helper, reused, instead of copy-pasted into two view functions.
- The response is `{"data": [...]}` — a bare array, not `{"lot_id": ..., "spaces": [...]}`. The URL already says which lot, and each space still carries its own `lot_id` from `SPACE_SELECT` if a caller needs to double-check.

### Step 3 — Register the blueprint (~5 min)

Open `backend/webapp/App/__init__.py` and add these two lines next to where you registered `health` and `auth` in earlier lessons:

```python
    from .views import lots
    app.register_blueprint(lots.bp)            # wires lots.py's routes into the running app
```

**Why this step exists:** creating a `Blueprint` in `lots.py` doesn't make Flask aware of it — `register_blueprint` is the step that actually wires its routes into the running app. Forget this line and every request to `/api/lots` will 404, even though the code looks correct. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

**Note on this vs. the shipped PoC:** this lesson (and every stacked CR after it) registers **only its own blueprint**, one line at a time, as the project's CRs land. The shipped PoC (which built all of B0–B9 in one pass) registers every blueprint at once in `create_app()` — that's a PoC-local shortcut, not the pattern to follow here.

---

## 🧪 Prove it works — testing guide

1. **Setup:** the server running (`flask run --port 8000`) and a token from B3 — log in once and save it, so the rest of the commands are shorter:

   **macOS / Linux**

   ```bash
   export T=<paste-a-token-from-B3-login>
   ```

   **Windows (PowerShell)**

   ```powershell
   $env:T = "<paste-a-token-from-B3-login>"
   ```

2. **Steps:**

   **macOS / Linux**

   ```bash
   curl -i http://localhost:8000/api/lots -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots/999/spaces -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots          # no token
   ```

   **Windows (PowerShell)**

   ```powershell
   Invoke-RestMethod http://localhost:8000/api/lots -Headers @{Authorization="Bearer $env:T"}
   Invoke-RestMethod http://localhost:8000/api/lots/1/spaces -Headers @{Authorization="Bearer $env:T"}
   Invoke-RestMethod http://localhost:8000/api/lots/999/spaces -Headers @{Authorization="Bearer $env:T"}
   Invoke-RestMethod http://localhost:8000/api/lots          # no token
   ```
3. **Expected:**
   - `/api/lots` → `200` `{"data":[{"id":1,"name":"Lot 1","number":1,"display_order":1,"map_image_url":"/lots/lot1.jpg","capacity":8,"available_count":6}, ...]}` — six lots total; Lot 1's `available_count` is 6 because `A4` is `disabled` and `A8` is `assigned`.
   - `/api/lots/1/spaces` → `200` **a bare array** under `data`, 8 spaces (`A1`..`A8`). `A1`–`A3`,`A5`–`A7` are `"status":"available"` with non-null `x`/`y`/`w`/`h`/`rotation`; `A4` is `"status":"disabled"`; `A8` is `"status":"assigned"` with `"rotation":90`, `"assigned_user_id":2`, `"assigned_user_name":"Alice"`, `"assigned_student_id":"STU001"`.
   - Lot `999` → `404`; no token → `401`.

**☁️ Cloud check (optional):** after `scripts/deploy.sh app backend`, with a token from the server's `/api/auth/student`:

**macOS / Linux**

```bash
curl -s http://<ElasticIp>/api/lots -H "Authorization: Bearer $T"
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod http://<ElasticIp>/api/lots -Headers @{Authorization="Bearer $env:T"}
```

Expect the same lots JSON the local server returned (assuming RDS was seeded).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B4: read lots and spaces"
git push -u origin cr/b4-lots
```

Then open a Pull Request on GitHub with **base = `cr/b3-auth`** — not `main` — since this CR stacks on top of it. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`401` even with a token** — double-check the header is exactly `Authorization: Bearer <token>` (one space, capital `B`), that you copied the whole token with no trailing newline, and that it hasn't expired (`JWT_EXP_HOURS` from your `.env`, set back in B0).
- **`/api/lots` itself 404s** — you likely skipped Step 3. Confirm `app.register_blueprint(lots.bp)` is actually in `backend/webapp/App/__init__.py` and that the import path is `.views` (not a typo).
- **`500 Internal Server Error`** — almost always a column-name mismatch between `serialize.py` and the migration from B2. Compare `pos_x`/`pos_y`/`pos_w`/`pos_h`, `assigned_user_id`, `assigned_student_id` in `SPACE_SELECT` against `backend/webapp/sql/migrations/001_init.sql` exactly.
- **`KeyError` inside `serialize.lot()`/`serialize.space()`** — the SQL you wrote and the serializer disagree on column names/aliases. `lot()` expects the query to alias its counts as `capacity` and `available_count`; `space()` expects the raw `pos_x`/`pos_y`/`pos_w`/`pos_h` names from `SPACE_SELECT`, not `x`/`y`/`w`/`h` (that rename happens *inside* the serializer, not the SQL).
- **Lot `1` returns `404` even though you have a token** — the database probably isn't seeded. Re-run B2's seed step and confirm `DATABASE_URL` in `.env` points at the same database you seeded.
- **`capacity`/`available_count` come back as `0` for lots that should have spaces** — check you used `LEFT JOIN`, not `JOIN`; a plain `JOIN` still returns the lot correctly if it *has* spaces, but the more common bug here is a typo in the `FILTER (WHERE s.status='available')` clause silently filtering everything out.
- **`/api/lots/1/spaces` comes back wrapped as `{"lot_id":1,"spaces":[...]}` instead of a bare array** — that shape belongs to `PUT /api/lots/:id/layout` (B8), not this endpoint. `GET .../spaces` returns `{"data": [...spaces]}` directly.

---

## 📝 Recap — what you built and learned

- You wrote the backend's **first read endpoints** — the first time a request actually reaches into the PostgreSQL database and comes back with real data.
- You introduced `backend/webapp/App/serialize.py`, the **shared serializer module** that will own every lot/space/interest/student JSON shape for the rest of the backend, so the view files that read and write these resources can never drift out of sync with each other.
- You saw how a single SQL query with `LEFT JOIN` + `count(...) FILTER (...)` can compute two aggregates (`capacity`, `available_count`) per lot without a loop or a second query.
- You used a **URL path parameter** (`<int:lot_id>`) to build a "one resource by id" endpoint, and the "check it exists, else 404" pattern you'll reuse constantly.
- You reused `@require_auth`, the `%s` parameter style, and the `{"data": ...}` / `{"error": ...}` envelopes from earlier lessons — proof that the patterns you learned in B1–B3 keep paying off.

---

## 📚 References

- [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) — grouping related routes.
- [Flask Quickstart: Routing](https://flask.palletsprojects.com/en/stable/quickstart/#routing) and [Variable Rules](https://flask.palletsprojects.com/en/stable/quickstart/#variable-rules) — mapping URLs (and URL parts) to functions.
- [Flask API: `jsonify`](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify) — building JSON responses.
- [MDN: HTTP `GET` method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) — what "read-only" means for an endpoint.
- [Postgres: `SELECT`](https://www.postgresql.org/docs/current/sql-select.html), [Table joins](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN), [Aggregate expressions (`FILTER`)](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES), and [`COALESCE`](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-COALESCE).
- [psycopg3: Passing parameters](https://www.psycopg.org/psycopg3/docs/basic/params.html) — safe `%s` substitution.
- [Wikipedia: Don't repeat yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) — why the serializer lives in one shared module.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [backend guide → CR B4](../backend-development-guide.md#cr-b4--read-lots--spaces).

---

## ➡️ Next lesson

**[Lesson B5 — Admin enables/disables spaces](B5-admin-enable-disable-spaces.md).** You'll add the first endpoint that *changes* data instead of just reading it, letting an admin mark a space available or disabled. → [source CR](../backend-development-guide.md#cr-b5--admin-enablesdisables-spaces).
