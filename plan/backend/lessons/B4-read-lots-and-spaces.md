# Lesson B4 — Read lots & spaces

> **Track:** Backend · **Lesson 5 of 8** (B0 → B7)
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first real database query with a `JOIN` and a count — but every later endpoint reuses this same shape)
> **🧩 Prerequisites:** you've finished [Lesson B3 — Authentication (login)](B3-authentication-login.md) — the server runs, the database is seeded, and you can log in and get a token.
> **🌿 CR branch:** `cr/b4-lots` (off `cr/b3-auth`) · **📄 Source CR:** [backend guide → CR B4](../backend-development-guide.md#cr-b4--read-lots--spaces) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

The first endpoints that actually **read real data out of the database** and hand it to whoever is logged in. Concretely, by the end of this hour you will have:

- `webapp/App/serialize.py` — a shared module holding the SQL fragment and the functions that turn a lot/space row into the exact JSON shape the frontend expects, so every view that touches lots or spaces reads from one place instead of re-inventing the shape.
- `GET /api/lots` — returns every parking lot, each with a `capacity` (total spaces) and an `available_count` (spaces still free), computed by the database in one query.
- `GET /api/lots/:id/spaces` — returns every space inside one specific lot as a bare array, or a `404` if that lot doesn't exist.
- Both routes protected by the `@require_auth` guard you built in B3 — no token, no data.

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

And a third idea, new to this lesson: this is also the first CR to reshape a row that more than one view module will need — spaces get read here, but they'll also get read (and rewritten) in B8's layout editor and later in assignments. Rather than let each view module invent its own `{...}` dict for a space, B4 introduces `webapp/App/serialize.py`: one shared SELECT and one shared shape-function per resource. Every later lesson imports it instead of re-deriving the shape, so the API can't drift out from under the frontend one view at a time.

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

```bash
source .venv/bin/activate      # your prompt should start with (.venv)
git checkout cr/b3-auth
git checkout -b cr/b4-lots      # create + switch to this lesson's branch
```

**What this does & why:** because `cr/b4-lots` branches off `cr/b3-auth` (not `main`), it inherits everything B0–B3 built — `.env`, the schema, the login endpoints — so you only have to write the two new routes below. This is the **stacked-CR** pattern the whole project follows. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Create `webapp/App/serialize.py` (~15 min)

Before writing the first view, create the module every lot/space (and later, interest/student) view will import instead of shaping its own JSON:

```python
# webapp/App/serialize.py
"""Turn database rows into the exact JSON shapes the frontend slices consume."""

# Shared SELECT so every view reads a space the same way. Callers append their
# own WHERE/ORDER BY and pass the rows straight to space().
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
        "capacity": row["capacity"],
        "available_count": row["available_count"],
    }


def space(row):
    """A parking space; positions/size are normalized fractions (NULL if unset)."""
    return {
        "id": row["id"],
        "lot_id": row["lot_id"],
        "label": row["label"],
        "status": row["status"],
        "x": row["pos_x"],
        "y": row["pos_y"],
        "w": row["pos_w"],
        "h": row["pos_h"],
        "rotation": row["rotation"],
        "assigned_user_id": row["assigned_user_id"],
        "assigned_user_name": row.get("assigned_user_name"),
        "assigned_student_id": row["assigned_student_id"],
    }
```

**Explanation, piece by piece:**
- **Why a shared module at all:** a space gets read here in B4, then rewritten by B8's layout editor and read again by the assignments endpoints later. Without one shared shape-function, each of those view files would invent its own dict — and the moment one of them forgets a field, or spells `assigned_user_id` differently, the frontend gets inconsistent JSON depending which endpoint answered. `serialize.py` makes that impossible: there is exactly one place that decides what a "space" looks like on the wire.
- `SPACE_SELECT` is a SQL *fragment*, not a full query — see `webapp/App/serialize.py:10`. It always joins `users` and `students` so a space can report who holds it (`assigned_user_name`) whether that's a login user or a roster-only student, but it deliberately has no `WHERE`/`ORDER BY` — callers append those, then run the fragment through `query()`/`query_one()`.
- `COALESCE(u.name, st.first || ' ' || st.last)` — a space's occupant is either a `users` row (login-holding student) or a `students`-only row; `COALESCE` picks whichever join actually matched. → [Postgres: `COALESCE`](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-COALESCE).
- `lot(row)` (`webapp/App/serialize.py:40`) and `space(row)` (`webapp/App/serialize.py:53`) are the row→JSON translators: every key on the right is the **snake_case** name the frontend actually consumes (`display_order`, `map_image_url`, `available_count`, `assigned_user_name`) — there's no camelCase renaming step to remember, because the database columns and the JSON keys already agree almost everywhere. The one deliberate rename is `space()`'s `x`/`y`/`w`/`h`: those come from the DB's `pos_x`/`pos_y`/`pos_w`/`pos_h` columns, because "position" is an implementation detail but `x`/`y`/`w`/`h` is what the map-rendering frontend code calls them.
- `row.get("assigned_user_name")` uses `.get` (not `row["..."]`) because that column only exists on rows built from `SPACE_SELECT` — a defensive touch in case some future caller passes a differently-shaped row into `space()`.

### Step 2 — Create `webapp/App/views/lots.py` (~20 min)

Create the file:

```python
# webapp/App/views/lots.py
from flask import Blueprint, jsonify

from ..db import query, query_one
from ..auth import require_auth
from .. import serialize

bp = Blueprint("lots", __name__)


@bp.get("/api/lots")
@require_auth
def list_lots():
    rows = query("""
        SELECT l.id, l.name, l.number, l.display_order, l.map_image_url,
               count(s.id)                                     AS capacity,
               count(s.id) FILTER (WHERE s.status='available') AS available_count
        FROM lots l
        LEFT JOIN spaces s ON s.lot_id = l.id
        GROUP BY l.id
        ORDER BY l.display_order, l.id
    """)
    return jsonify({"data": [serialize.lot(row) for row in rows]})
```

**Explanation, piece by piece:**
- `from ..db import query, query_one` / `from ..auth import require_auth` / `from .. import serialize` — the two double-dots mean "go up one package level, into `App/`." You're reusing the database helper from B3's `db.py`, the login guard from `auth.py`, and the row-shaping module you just wrote — nothing here reinvents them. → [Python: Relative imports](https://docs.python.org/3/reference/import.html#package-relative-imports).
- `bp = Blueprint("lots", __name__)` — same pattern as `health.py` and `auth.py` before it: one file, one blueprint, one group of related routes. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).
- `@bp.get("/api/lots")` then `@require_auth` **underneath** it — decorators apply bottom-up, so `require_auth` runs *first* and checks the token before Flask ever calls `list_lots`. No valid token, no query, no data. → [Flask Quickstart: Routing](https://flask.palletsprojects.com/en/stable/quickstart/#routing).
- The SQL itself, in plain English: "for every lot, count how many spaces it has (`capacity`), and separately count only the ones that are still `available` (`available_count`)." The `LEFT JOIN` matters — it keeps a lot in the results even if it has zero spaces; a plain `JOIN` would silently drop it. `FILTER (WHERE ...)` is a neat trick that lets one `count()` ignore rows that don't match, so you get two different counts from one query instead of two separate ones. → [Postgres: Table joins](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) · [Postgres: Aggregate expressions (`FILTER`)](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES).
- `serialize.lot(row)` does the row→JSON translation for you — see `webapp/App/views/lots.py:34`. Because the SQL's column aliases (`capacity`, `available_count`) already match what `serialize.lot()` expects, there's nothing left for this view to do but hand each row to the serializer.
- `return jsonify({"data": [...]})` — the same `{"data": ...}` envelope you already saw in `health.py` and `auth.py`. Keeping every success response wrapped the same way means the frontend can handle them all the same way. → [Flask API: `jsonify`](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify).

Now add the second route, in the same file:

```python
def _lot_spaces(lot_id):
    """Every space in a lot, serialized, ordered by id."""
    rows = query(serialize.SPACE_SELECT + " WHERE s.lot_id = %s ORDER BY s.id", (lot_id,))
    return [serialize.space(row) for row in rows]


@bp.get("/api/lots/<int:lot_id>/spaces")
@require_auth
def lot_spaces(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return jsonify({"error": {"code": "not_found", "message": "Lot not found"}}), 404
    return jsonify({"data": _lot_spaces(lot_id)})
```

**Explanation, piece by piece:**
- `"/api/lots/<int:lot_id>/spaces"` — the `<int:lot_id>` segment is a **URL path parameter**. Flask reads whatever number is in that position of the URL, converts it to a Python `int`, and passes it into `lot_spaces(lot_id)` as an argument. Visit `/api/lots/1/spaces` and `lot_id` is `1`. → [Flask Quickstart: Variable Rules](https://flask.palletsprojects.com/en/stable/quickstart/#variable-rules).
- `query_one("SELECT id FROM lots WHERE id = %s", (lot_id,))` — the `%s` is a placeholder, and `(lot_id,)` is the value that fills it in. psycopg substitutes it *safely*, so a weird value in the URL can never be misread as SQL. Always use `%s` + a parameter tuple — never build SQL by pasting a variable into a string. → [psycopg3: Passing parameters](https://www.psycopg.org/psycopg3/docs/basic/params.html).
- `if ... is None: return ... , 404` — checking the lot exists *before* querying its spaces means a bad id gets a clean `404 Not Found` instead of an empty (and misleading) list. This is the same `{"error": {"code": ..., "message": ...}}` shape used everywhere else in the API.
- `_lot_spaces(lot_id)` (`webapp/App/views/lots.py:26`) is pulled into its own helper because B8's layout editor needs the exact same "fetch + serialize every space in a lot" step to build its response — one helper, reused, instead of the query copy-pasted into two view functions.
- The response is `{"data": [...] }` — **a bare array**, not `{"data": {"lot_id": ..., "spaces": [...]}}`. The URL already says which lot (`/api/lots/1/spaces`), so the body doesn't repeat it; each space already carries its own `lot_id` field from `SPACE_SELECT` if a caller needs to double-check.

### Step 3 — Register the blueprint (~5 min)

Open `webapp/App/__init__.py` and add these two lines next to where you registered `health` and `auth` in earlier lessons:

```python
    from .views import lots
    app.register_blueprint(lots.bp)
```

**Why this step exists:** creating a `Blueprint` in `lots.py` doesn't make Flask aware of it — `register_blueprint` is the step that actually wires its routes into the running app. Forget this line and every request to `/api/lots` will 404, even though the code looks correct. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

**Note on this vs. the shipped PoC:** this lesson (and every stacked CR after it) registers **only its own blueprint**, one line at a time, as the project's CRs land. The shipped PoC (which built all of B0–B9 in one pass) registers every blueprint at once in `create_app()` — that's a PoC-local shortcut, not the pattern to follow here.

---

## 🧪 Prove it works — testing guide

1. **Setup:** the server running (`flask run --port 8000`) and a token from B3 — log in once and save it, so the rest of the commands are shorter:
   ```bash
   export T=<paste-a-token-from-B3-login>
   ```
2. **Steps:**
   ```bash
   curl -i http://localhost:8000/api/lots -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots/999/spaces -H "Authorization: Bearer $T"
   curl -i http://localhost:8000/api/lots          # no token
   ```
3. **Expected:**
   - `/api/lots` → `200` `{"data":[{"id":1,"name":"Lot 1","number":1,"display_order":1,"map_image_url":"/lots/lot1.jpg","capacity":8,"available_count":6}, ...]}` — six lots total; Lot 1's `available_count` is 6 because `A4` is `disabled` and `A8` is `assigned`.
   - `/api/lots/1/spaces` → `200` **a bare array** under `data`, 8 spaces (`A1`..`A8`). `A1`–`A3`,`A5`–`A7` are `"status":"available"` with non-null `x`/`y`/`w`/`h`/`rotation`; `A4` is `"status":"disabled"`; `A8` is `"status":"assigned"` with `"rotation":90`, `"assigned_user_id":2`, `"assigned_user_name":"Alice"`, `"assigned_student_id":"STU001"`.
   - Lot `999` → `404`; no token → `401`.

**☁️ Cloud check (optional):** after `./release.sh backend`, with a token from the server's `/api/auth/student`:
```bash
curl -s http://<ElasticIp>/api/lots -H "Authorization: Bearer $T"
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
- **`/api/lots` itself 404s** — you likely skipped Step 3. Confirm `app.register_blueprint(lots.bp)` is actually in `webapp/App/__init__.py` and that the import path is `.views` (not a typo).
- **`500 Internal Server Error`** — almost always a column-name mismatch between `serialize.py` and the migration from B2. Compare `pos_x`/`pos_y`/`pos_w`/`pos_h`, `assigned_user_id`, `assigned_student_id` in `SPACE_SELECT` against `webapp/sql/migrations/001_init.sql` exactly.
- **`KeyError` inside `serialize.lot()`/`serialize.space()`** — the SQL you wrote and the serializer disagree on column names/aliases. `lot()` expects the query to alias its counts as `capacity` and `available_count`; `space()` expects the raw `pos_x`/`pos_y`/`pos_w`/`pos_h` names from `SPACE_SELECT`, not `x`/`y`/`w`/`h` (that rename happens *inside* the serializer, not the SQL).
- **Lot `1` returns `404` even though you have a token** — the database probably isn't seeded. Re-run B2's seed step and confirm `DATABASE_URL` in `.env` points at the same database you seeded.
- **`capacity`/`available_count` come back as `0` for lots that should have spaces** — check you used `LEFT JOIN`, not `JOIN`; a plain `JOIN` still returns the lot correctly if it *has* spaces, but the more common bug here is a typo in the `FILTER (WHERE s.status='available')` clause silently filtering everything out.
- **`/api/lots/1/spaces` comes back wrapped as `{"lot_id":1,"spaces":[...]}` instead of a bare array** — that shape belongs to `PUT /api/lots/:id/layout` (B8), not this endpoint. `GET .../spaces` returns `{"data": [...spaces]}` directly.

---

## 📝 Recap — what you built and learned

- You wrote the backend's **first read endpoints** — the first time a request actually reaches into the PostgreSQL database and comes back with real data.
- You introduced `webapp/App/serialize.py`, the **shared serializer module** that will own every lot/space/interest/student JSON shape for the rest of the backend, so the view files that read and write these resources can never drift out of sync with each other.
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
