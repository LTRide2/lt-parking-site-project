# Lesson B7 — Admin assigns a space

> **Track:** Backend · **Lesson 8 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (one new idea — the **database transaction** — but the code is a pattern you'll reuse, not something new each time).
> **🧩 Prerequisites:** you've done [Lesson B6 — Student registers interest](B6-student-registers-interest.md) (JWT auth, `@require_role`, and a `pending` interest row you can test against).
> **🌿 CR branch:** `cr/b7-assignments` (off `cr/b6-interest`) · **📄 Source CR:** [backend guide → CR B7](../backend-development-guide.md#cr-b7--admin-assigns-a-space) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Two admin-only endpoints that turn a student's *interest* into a real, permanent *assignment* — and undo it if needed:

- **`POST /api/assignments`** — body `{"spaceId", "userId"}` (optional `"interestId"`) → marks the space `assigned`, records who got it, flips the matching interest request to `fulfilled`, and remembers which admin made the call.
- **`DELETE /api/assignments/<id>`** — undoes an assignment: the space goes back to `available`.

The important part isn't just "two endpoints" — it's that every write inside each of them happens inside **one database transaction**, so the space, the assignment record, and the interest row always change *together*. There's no possible moment where the space says "assigned" but no assignment record exists.

**✅ Done when (your deliverable checklist):**
- [ ] `POST /api/assignments` with a valid admin token returns `201`, the target space becomes `assigned`, and the student's matching `pending` interest becomes `fulfilled`.
- [ ] Assigning the **same space** a second time returns `409` (not a crash, not a half-applied change).
- [ ] `DELETE /api/assignments/<id>` returns `200` and the space is back to `available` when you re-read the lot.
- [ ] An admin hitting a student-only route (or a student hitting these admin routes) still gets `403`, same as every other CR.
- [ ] Your work is committed on branch `cr/b7-assignments` and pushed, PR base = `cr/b6-interest` (this CR stacks on B6, not `main`).

---

## 🤔 Why this lesson matters

Think about what "assign a space" actually touches: the **space** (its status, who it belongs to now), the **assignment** (a permanent record of who did the assigning and when), and the **interest request** (it should stop showing up as "pending" once it's been granted). That's three different rows in three different tables that all need to change *together*.

What happens if your server crashes — or the database connection drops — right after the first `UPDATE` but before the second? Without protection, you could end up with a space marked `assigned` that has **no** assignment record backing it up. Nobody could tell who it belongs to, and the next admin who looks at it has no idea what happened. This is exactly the kind of bug that's rare, hard to reproduce, and infuriating to debug in production.

The fix is a **database transaction**: you group every related write into one all-or-nothing unit. Either every statement succeeds and you `COMMIT`, or something goes wrong and you `ROLLBACK` — undoing everything as if none of it had happened. This all-or-nothing guarantee is called **atomicity**, and it's one of the four properties (the "A" in **ACID**) that make databases trustworthy for anything that matters — money, inventory, or, in our case, parking spaces.

> **📸 Note — this endpoint is admin-only on purpose.** You may have seen the UI prototype let a *student* click an open spot and claim it directly. That's not what B7 builds. The real flow is: a student *registers interest* (B6), then an *admin* reviews and assigns the spot (B7). If a future CR ever adds real student self-claiming, it would need its own endpoint with its own rules — this one stays admin-only.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Database transaction** | A group of SQL statements that succeed or fail together, as one unit. | [PostgreSQL: transactions tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| **ACID / atomicity** | The "A" in ACID — the guarantee that a transaction is all-or-nothing, never half-done. | [Wikipedia: ACID](https://en.wikipedia.org/wiki/ACID) |
| **SQL `BEGIN` / `COMMIT` / `ROLLBACK`** | The commands that start a transaction, save it permanently, or undo it. | [PostgreSQL: `BEGIN`](https://www.postgresql.org/docs/current/sql-begin.html) · [`COMMIT`](https://www.postgresql.org/docs/current/sql-commit.html) · [`ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html) |
| **HTTP `DELETE`** | The HTTP method meaning "remove or undo this resource." | [MDN: DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) |
| **psycopg transactions** | How Python's PostgreSQL driver opens, commits, and rolls back a transaction. | [psycopg3 docs: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → build `assignments.py` and understand the transaction (30) → register the blueprint (5) → local testing (15) → commit & push (5).

**You need, from earlier lessons:** the server running locally (B1), the database seeded (B2), login working (B3), and — specifically for testing this CR — a student who has already registered interest in a lot, so there's a `pending` row to fulfill (B6).

**Branch off B6** (this CR stacks directly on top of it, not `main`):

```bash
git checkout cr/b6-interest
git checkout -b cr/b7-assignments
```

**What this does & why:** because B7's code depends on B6 existing (the interest table, the auth decorator), you build on top of that branch instead of `main`. Reviewing this CR's PR will show *only* B7's changes, not B6's. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Create `webapp/App/views/assignments.py` (~30 min)

Create the file with this exact content:

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

**Explanation, piece by piece:**

**Imports.** `import psycopg` — this lesson is the first time you catch a specific *database* error (`psycopg.errors.UniqueViolation`) instead of just the generic Python ones. `from ..db import query_one, get_db` — you've used `query_one` since B4 for simple lookups, but `get_db()` is new: it hands you the **raw connection object** instead of a helper that runs one statement and returns. You need the raw connection here because you're about to run *three* statements that must all succeed or all fail together — the `query()` / `query_one()` / `execute()` helpers in `db.py` each commit (or just read) after a single statement, which is exactly wrong when multiple writes have to be atomic.

**Validation before the transaction.** Notice all four checks — are `spaceId`/`userId` integers, does the space exist, does the user exist, is the space actually `available` — happen *before* `get_db()` is ever touched. Failing fast on bad input, with plain `SELECT`s, means the transaction itself only ever contains writes that are already known to make sense. → Reference: [12-Factor: fail fast](https://12factor.net/config) (the same "fail loud, fail early" idea from B0, applied to requests instead of missing config).

**The transaction — the heart of this lesson.**
```python
db = get_db()
try:
    with db.cursor() as cur:
        cur.execute(...)   # 1. INSERT the assignment
        cur.execute(...)   # 2. UPDATE the space to 'assigned'
        cur.execute(...)   # 3. UPDATE the interest row to 'fulfilled'
    db.commit()
except psycopg.errors.UniqueViolation:
    db.rollback()
    return _err(...)
except Exception:
    db.rollback()
    raise
```
- Every `cur.execute(...)` inside the `with db.cursor() as cur:` block is part of the **same transaction** — psycopg opens one automatically the moment you run the first statement on a connection. → Reference: [psycopg3: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- `db.commit()` only runs if all three statements succeeded with no exception — that's the moment PostgreSQL makes the changes permanent. → Reference: [PostgreSQL `COMMIT`](https://www.postgresql.org/docs/current/sql-commit.html).
- `except psycopg.errors.UniqueViolation: db.rollback()` — this fires if a database constraint (a partial unique index, the same trick B6 used for interest) rejects the insert — e.g., a race where two admins assign the same space at nearly the same instant. `db.rollback()` undoes anything the transaction had already done, so the space is **not** left half-assigned. → Reference: [PostgreSQL `ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html).
- `except Exception: db.rollback(); raise` — a safety net for *any other* unexpected error: roll back first (never leave a half-done transaction sitting open), then `raise` so the error still surfaces (Flask will turn it into a `500`, and you'll see it in your terminal) instead of being silently swallowed.
- **Why this matters in practice:** if statement 2 or 3 above ever failed for some reason, statement 1's `INSERT` would be rolled back too — even though it "already ran." That's atomicity: from the outside, it's as if none of the three statements ever happened.

**The two interest-update branches.** If the request included an `interestId`, that *specific* interest row is marked `fulfilled` — useful when an admin is looking at one particular request in a list. If not, the code falls back to fulfilling *any* `pending` interest from that user — handy for quick manual assigns where you already know who gets the space but didn't look up their interest row's id.

**`delete_assignment` — the undo.** Same shape, smaller: look the assignment up first (`404` if it doesn't exist), then in one transaction flip `assignments.active` to `FALSE` and the space back to `status='available'` with `assigned_user_id=NULL`. Notice it does **not** touch the interest row — undoing an assignment doesn't automatically reopen the student's request; that's a deliberate limitation of this CR, not a bug.

### Step 2 — Register the blueprint (~5 min)

Open `webapp/App/__init__.py` and add, alongside the other blueprint registrations:

```python
    from .views import assignments
    app.register_blueprint(assignments.bp)
```

**Why:** exactly like every earlier view module (health, auth, lots, spaces, interest) — Flask only knows about routes in a file once you register that file's blueprint with the app. Forget this line and `POST /api/assignments` will 404 as if the route doesn't exist, even though the file is right there. → Reference: [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

---

## 🧪 Prove it works — testing guide

**Setup:** server running; `$A` = admin token; `$S` = student token. Make sure a student has already registered interest (B6), so there's a `pending` row. Use a known student id (Jane = `2`) and an available space id from the seed data (e.g. `4`).

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

**What you should see:**
- First `POST` → `201`; space `4` becomes `assigned` with `assignedUserId: 2`; the student's interest becomes `fulfilled`.
- Re-assigning space `4` (already `assigned`, not `available`) → `409`.
- `DELETE` → `200`; re-reading the lot shows space `4` back to `available`.
- (As with every earlier CR) a student token on either of these routes, or an admin token where a student route is expected, → `403`.

**☁️ Cloud check (optional):** after `./release.sh backend`, run the assign → read → fulfilled sequence against `http://<ElasticIp>`. With B7 deployed, the **whole backend is live in the cloud** — this is a good moment to run the full two-window browser story from the backend guide's Part 1E against the deployed site (`./release.sh all`) as your real end-to-end cloud test.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B7: transactional assign + unassign"
git push -u origin cr/b7-assignments
```

Then open a Pull Request on GitHub with **base = `cr/b6-interest`** (this CR stacks on B6, not `main` — see the [stacked-CR branching strategy](../../plan.md#81-cr-workflow--branching-strategy)). Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`POST /api/assignments` returns `404` even though you registered the blueprint** — double-check the import line is inside `create_app()` in `__init__.py`, in the same indentation block as the other blueprint registrations, and that you restarted `flask run` after editing.
- **You get `409` on your *first* attempt, not the second** — the space you picked probably isn't `status='available'` already (maybe it was disabled in B5, or assigned by an earlier test run). `GET /api/lots/1/spaces` to check its current status, or pick a different space id.
- **`interest` never flips to `fulfilled`** — confirm the student actually has a `pending` row for that exact `user_id` (B6's `POST /api/interest`), and that you didn't pass a mismatched `interestId` in the body — if it's provided, only *that* row is updated, not "any pending row from this user."
- **A crash midway through testing leaves the space `assigned` but no matching row shows up in `assignments`** — that would mean the transaction isn't set up the way this lesson shows. Re-check that all three `cur.execute(...)` calls are inside the *same* `with db.cursor() as cur:` block, and that `db.commit()` only runs after all three, not after each one.
- **`AttributeError` or `KeyError` on `g.user["id"]`** — this means `@require_role("admin")` didn't run (or your token is missing/expired). Get a fresh admin token from B3's login endpoint and try again.

---

## 📝 Recap

- You wrapped three related writes — insert an assignment, update a space, update an interest — in **one database transaction**, so they succeed or fail as a single unit.
- You learned **atomicity** (the "A" in ACID) and practiced it with `db.commit()` / `db.rollback()` via psycopg, instead of the single-statement `query()`/`execute()` helpers you'd used in every earlier lesson.
- You caught a specific database error (`psycopg.errors.UniqueViolation`) to turn a constraint violation into a clean `409` instead of a crash.
- You built the undo path (`DELETE`) with the same transactional pattern, smaller.
- **This is the last backend lesson.** Between B0 and B7, you've built the entire API: config, health check, schema, auth, reads, admin writes, student interest, and now transactional assignment.

---

## 📚 References

- [PostgreSQL — Transactions tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html).
- [Wikipedia — ACID](https://en.wikipedia.org/wiki/ACID) — atomicity, consistency, isolation, durability.
- [PostgreSQL — `BEGIN`](https://www.postgresql.org/docs/current/sql-begin.html), [`COMMIT`](https://www.postgresql.org/docs/current/sql-commit.html), [`ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html).
- [psycopg3 documentation — Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- [MDN — HTTP `DELETE`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE).
- [Flask — Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).
- [plan.md §8.1 — CR workflow & branching strategy](../../plan.md#81-cr-workflow--branching-strategy).
- Source of truth for this lesson: [backend guide → CR B7](../backend-development-guide.md#cr-b7--admin-assigns-a-space).

---

## ➡️ Next lesson

**That's the whole backend track — nice work finishing all 8 lessons.** From here, pick your next track:

- Build the site that calls this API: start the [UI track at Lesson U0](../../ui/lessons/README.md).
- Or put this backend online for real: start the [Deploy track at Lesson D0 — AWS account setup](../../deploy/lessons/D0-aws-account-setup.md).
