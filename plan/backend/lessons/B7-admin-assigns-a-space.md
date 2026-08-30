# Lesson B7 — Admin assigns a space

> **Track:** Backend · **Lesson 8 of 10**
> **⏱ Time:** ~65 min · **🎚 Difficulty:** moderate (one new idea — the **database transaction** — but the code is a pattern you'll reuse across all three routes in this file).
> **🧩 Prerequisites:** you've done [Lesson B6 — Student registers interest](B6-student-registers-interest.md) (JWT auth, `@require_role`, and a `pending` interest row you can test against).
> **🌿 CR branch:** `cr/b7-assignments` (off `cr/b6-interest`) · **📄 Source CR:** [backend guide → CR B7](../backend-development-guide.md#cr-b7--admin-assigns-a-space) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Three admin-only endpoints that turn a student's *interest* into a real assignment — move it, or undo it:

- **`POST /api/assignments`** — body `{"spaceId", "userId"}` (optional `"interestId"`) → marks the space `assigned`, records who got it, flips the matching interest request to `fulfilled`, and syncs the student **roster** row so the front office sees the slot too.
- **`POST /api/assignments/move`** — body `{"fromSpaceId", "toLotId"}` → frees the occupant's current space and re-queues their request as `pending` **in the new lot**, so an admin can pick a fresh spot there. It does *not* auto-pick a spot for them.
- **`DELETE /api/assignments/<spaceId>`** — undoes an assignment: the space goes back to `available` and the student's request re-opens.

The important part isn't the endpoint count — it's that every write inside each of them happens inside **one database transaction**, so the space, the assignment record, the interest row, and the roster row always change *together*. There's no possible moment where the space says "assigned" but the roster still shows the student as unassigned.

**✅ Done when (your deliverable checklist):**
- [ ] `POST /api/assignments` with a valid admin token returns `201`, the target space becomes `assigned`, the student's matching `pending` interest becomes `fulfilled`, and the matching `students` roster row picks up the new `assigned_slot` + `parking_status: valid`.
- [ ] Assigning the **same space** a second time returns `409` (not a crash, not a half-applied change).
- [ ] `DELETE /api/assignments/<spaceId>` — note the id is the **space's** id, not an assignment id — returns `204`; re-reading the lot shows the space `available` again and the student's request back to `pending`.
- [ ] `POST /api/assignments/move` frees the occupant's current space and puts their request back as `pending` in the target lot, ready for an admin to assign a fresh spot there.
- [ ] An admin hitting a student-only route (or a student hitting these admin routes) still gets `403`, same as every other CR.
- [ ] Your work is committed on branch `cr/b7-assignments` and pushed, PR base = `cr/b6-interest` (this CR stacks on B6, not `main`).

---

## 🤔 Why this lesson matters

Think about what "assign a space" actually touches: the **space** (its status, who it belongs to now), the **assignment** (a record of who did the assigning and when), the **interest request** (it should stop showing up as "pending" once it's been granted), and the **roster row** (the school's existing student record, which needs to show the same slot for anyone who isn't looking at this app). That's four different rows in four different tables that all need to change *together*.

What happens if your server crashes — or the database connection drops — right after the first `UPDATE` but before the rest? Without protection, you could end up with a space marked `assigned` that has **no** assignment record backing it, or a roster row that still says `unassigned` for a student who very much has a spot. This is exactly the kind of bug that's rare, hard to reproduce, and infuriating to debug in production.

The fix is a **database transaction**: you group every related write into one all-or-nothing unit. Either every statement succeeds and you `commit()`, or something goes wrong and you `rollback()` — undoing everything as if none of it had happened. This all-or-nothing guarantee is called **atomicity**, and it's one of the four properties (the "A" in **ACID**) that make databases trustworthy for anything that matters — money, inventory, or, in our case, parking spaces.

> **📸 Note — this endpoint is admin-only on purpose.** You may have seen the UI prototype let a *student* click an open spot and claim it directly. That's not what B7 builds. The real flow is: a student *registers interest* (B6), then an *admin* reviews and assigns the spot (B7). If a future CR ever adds real student self-claiming, it would need its own endpoint with its own rules — this one stays admin-only.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Database transaction** | A group of SQL statements that succeed or fail together, as one unit. | [PostgreSQL: transactions tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| **ACID / atomicity** | The "A" in ACID — the guarantee that a transaction is all-or-nothing, never half-done. | [Wikipedia: ACID](https://en.wikipedia.org/wiki/ACID) |
| **`connection.commit()` / `.rollback()`** | The calls that save a transaction permanently, or undo it. | [psycopg3 docs: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) |
| **HTTP `DELETE`** | The HTTP method meaning "remove or undo this resource." | [MDN: DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) |
| **Denormalized sync** | Copying the same fact (here: "who holds this slot") into a second table so other tools that only read the roster stay correct. | [Wikipedia: Denormalization](https://en.wikipedia.org/wiki/Denormalization) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → build `assignments.py` and understand the transaction (35) → register the blueprint (5) → local testing (15) → commit & push (5).

**You need, from earlier lessons:** the server running locally (B1), the database seeded (B2), login working (B3), and — specifically for testing this CR — a student who has already registered interest in a lot, so there's a `pending` row to fulfill (B6). The seed data (`webapp/sql/seed.sql`) already gives you one: Bob (`STU002`, user id 3) has a `pending` request on Lot 4.

**Branch off B6** (this CR stacks directly on top of it, not `main`):

```bash
git checkout cr/b6-interest
git checkout -b cr/b7-assignments
```

**What this does & why:** because B7's code depends on B6 existing (the interest table, the auth decorator), you build on top of that branch instead of `main`. Reviewing this CR's PR will show *only* B7's changes, not B6's. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Create `webapp/App/views/assignments.py` (~35 min)

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


def _resolve_student_id(cursor, student_id, user_id):
    """The roster student behind a space: direct student_id, else the login user's code."""
    if student_id:
        cursor.execute("SELECT student_id FROM students WHERE student_id = %s", (student_id,))
        if cursor.fetchone():
            return student_id
    if user_id is not None:
        cursor.execute("SELECT code FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        if row and row["code"]:
            cursor.execute("SELECT student_id FROM students WHERE student_id = %s", (row["code"],))
            if cursor.fetchone():
                return row["code"]
    return None


def _set_roster_slot(cursor, student_id, user_id, slot_text):
    """Point a roster student at a slot (valid) or clear it (unassigned)."""
    resolved = _resolve_student_id(cursor, student_id, user_id)
    if resolved is None:
        return
    parking_status = "valid" if slot_text else "unassigned"
    cursor.execute(
        "UPDATE students SET assigned_slot = %s, parking_status = %s WHERE student_id = %s",
        (slot_text, parking_status, resolved))


@bp.post("/api/assignments")
@require_role("admin")
def create_assignment():
    body = request.get_json(silent=True) or {}
    space_id, user_id = body.get("spaceId"), body.get("userId")
    interest_id = body.get("interestId")
    if not isinstance(space_id, int) or not isinstance(user_id, int):
        return _err("bad_request", "spaceId and userId (integers) are required", 400)

    space = query_one("SELECT id, lot_id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    user = query_one("SELECT id, code FROM users WHERE id = %s", (user_id,))
    if user is None:
        return _err("not_found", "User not found", 404)
    if space["status"] != "available":
        return _err("conflict", f"Space is {space['status']}, not assignable", 409)

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO assignments (space_id, user_id, assigned_by, active) "
                "VALUES (%s, %s, %s, TRUE)", (space_id, user_id, g.user["id"]))
            cursor.execute(
                "UPDATE spaces SET status='assigned', assigned_user_id=%s, "
                "assigned_student_id=%s WHERE id=%s",
                (user_id, user["code"], space_id))
            if isinstance(interest_id, int):
                cursor.execute("UPDATE interest SET status='fulfilled' WHERE id=%s", (interest_id,))
            else:
                cursor.execute(
                    "UPDATE interest SET status='fulfilled' "
                    "WHERE user_id=%s AND status='pending'", (user_id,))
            cursor.execute("SELECT name FROM lots WHERE id = %s", (space["lot_id"],))
            lot_row = cursor.fetchone()
            lot_name = lot_row["name"] if lot_row else f"Lot {space['lot_id']}"
            slot_text = f"{lot_name} · {_label(cursor, space_id)}"
            _set_roster_slot(cursor, user["code"], user_id, slot_text)
        connection.commit()
    except psycopg.errors.UniqueViolation:
        connection.rollback()
        return _err("conflict", "Space already has an active assignment", 409)
    except Exception:
        connection.rollback()
        raise

    return jsonify({"data": {"space_id": space_id, "user_id": user_id,
                             "interest_id": interest_id if isinstance(interest_id, int) else None}}), 201


@bp.post("/api/assignments/move")
@require_role("admin")
def move_assignment():
    body = request.get_json(silent=True) or {}
    from_space_id, to_lot_id = body.get("fromSpaceId"), body.get("toLotId")
    if not isinstance(from_space_id, int) or not isinstance(to_lot_id, int):
        return _err("bad_request", "fromSpaceId and toLotId (integers) are required", 400)

    space = query_one(
        "SELECT id, lot_id, status, assigned_user_id, assigned_student_id FROM spaces WHERE id = %s",
        (from_space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if query_one("SELECT id FROM lots WHERE id = %s", (to_lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)
    if space["status"] != "assigned":
        return _err("conflict", "Source space is not assigned", 409)

    freed_user_id = space["assigned_user_id"]
    freed_student_id = space["assigned_student_id"]
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE assignments SET active=FALSE WHERE space_id=%s AND active", (from_space_id,))
            cursor.execute(
                "UPDATE spaces SET status='available', assigned_user_id=NULL, "
                "assigned_student_id=NULL WHERE id=%s", (from_space_id,))
            _set_roster_slot(cursor, freed_student_id, freed_user_id, None)
            # Re-queue the occupant's request as PENDING in the new lot (admin
            # then picks a spot there). Open a fresh request if they had none.
            if freed_user_id is not None:
                cursor.execute(
                    "UPDATE interest SET lot_id=%s, space_ids='{}', status='pending' "
                    "WHERE user_id=%s AND lot_id=%s AND status='fulfilled'",
                    (to_lot_id, freed_user_id, space["lot_id"]))
                if cursor.rowcount == 0:
                    cursor.execute(
                        "INSERT INTO interest (user_id, lot_id, space_ids, status) "
                        "VALUES (%s, %s, '{}', 'pending') "
                        "ON CONFLICT DO NOTHING", (freed_user_id, to_lot_id))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return jsonify({"data": {"from_space_id": from_space_id, "to_lot_id": to_lot_id}})


@bp.delete("/api/assignments/<int:space_id>")
@require_role("admin")
def delete_assignment(space_id):
    space = query_one(
        "SELECT id, lot_id, status, assigned_user_id, assigned_student_id FROM spaces WHERE id = %s",
        (space_id,))
    if space is None:
        return _err("not_found", "Assignment not found", 404)

    freed_user_id = space["assigned_user_id"]
    freed_student_id = space["assigned_student_id"]
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE assignments SET active=FALSE WHERE space_id=%s AND active", (space_id,))
            cursor.execute(
                "UPDATE spaces SET status='available', assigned_user_id=NULL, "
                "assigned_student_id=NULL WHERE id=%s", (space_id,))
            # Put the student's request back in the pending queue so they can be
            # reassigned, and clear their roster slot. One-active-request-per-
            # student (enforced at registration) guarantees no rival pending row.
            if freed_user_id is not None:
                cursor.execute(
                    "UPDATE interest SET status='pending' "
                    "WHERE user_id=%s AND lot_id=%s AND status='fulfilled'",
                    (freed_user_id, space["lot_id"]))
            _set_roster_slot(cursor, freed_student_id, freed_user_id, None)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return "", 204


def _label(cursor, space_id):
    cursor.execute("SELECT label FROM spaces WHERE id = %s", (space_id,))
    row = cursor.fetchone()
    return row["label"] if row else ""
```

→ This is the real shipped file, `webapp/App/views/assignments.py` (clone A ground truth), not a simplified version.

**Explanation, piece by piece:**

**Imports.** `import psycopg` — this lesson is the first time you catch a specific *database* error (`psycopg.errors.UniqueViolation`) instead of just the generic Python ones. `from ..db import query_one, get_db` — you've used `query_one` since B4 for simple lookups, but `get_db()` is new: it hands you the **raw connection object** instead of a helper that runs one statement and returns. You need the raw connection here because you're about to run *several* statements that must all succeed or all fail together — the `query()` / `query_one()` / `execute()` helpers in `db.py` each commit (or just read) after a single statement, which is exactly wrong when multiple writes have to be atomic.

**The roster helpers (`_resolve_student_id`, `_set_roster_slot`, `webapp/App/views/assignments.py:15-39`).** The `students` table (the school's existing roster, from B2) is keyed by its own `student_id` text column — not by `users.id`. A space can be held by a login user (whose `code` matches a roster `student_id`) or, in principle, by a roster student with no login at all, which is why `_resolve_student_id` tries the direct `student_id` first and only falls back to looking up the user's `code`. `_set_roster_slot` then either writes a slot + `parking_status='valid'`, or clears both back to `unassigned` when `slot_text` is `None`. Every one of the three routes below calls this helper *inside* its transaction, so the roster row changes atomically with the space and the assignment.

**`create_assignment` (`webapp/App/views/assignments.py:42-90`) — validation before the transaction.** Notice all four checks — are `spaceId`/`userId` integers, does the space exist, does the user exist, is the space actually `available` — happen *before* `get_db()` is ever touched. Failing fast on bad input, with plain `SELECT`s, means the transaction itself only ever contains writes that are already known to make sense. → Reference: [12-Factor: fail fast](https://12factor.net/config) (the same "fail loud, fail early" idea from B0, applied to requests instead of missing config).

**The transaction — the heart of this lesson.**
```python
connection = get_db()
try:
    with connection.cursor() as cursor:
        cursor.execute(...)   # 1. INSERT the assignment
        cursor.execute(...)   # 2. UPDATE the space to 'assigned'
        cursor.execute(...)   # 3. UPDATE the interest row to 'fulfilled'
        cursor.execute(...)   # 4. read the lot name + label, sync the roster row
    connection.commit()
except psycopg.errors.UniqueViolation:
    connection.rollback()
    return _err(...)
except Exception:
    connection.rollback()
    raise
```
- Every `cursor.execute(...)` inside the `with connection.cursor() as cursor:` block is part of the **same transaction** — psycopg opens one automatically the moment you run the first statement on a connection. → Reference: [psycopg3: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- `connection.commit()` only runs if every statement succeeded with no exception — that's the moment PostgreSQL makes the changes permanent. → Reference: [PostgreSQL `COMMIT`](https://www.postgresql.org/docs/current/sql-commit.html).
- `except psycopg.errors.UniqueViolation: connection.rollback()` — this fires if the `one_active_assignment_per_space` partial unique index (B2) rejects the insert — e.g., a race where two admins assign the same space at nearly the same instant. `connection.rollback()` undoes anything the transaction had already done, so the space is **not** left half-assigned. Response: `409` `"Space already has an active assignment"`. → Reference: [PostgreSQL `ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html).
- `except Exception: connection.rollback(); raise` — a safety net for *any other* unexpected error: roll back first (never leave a half-done transaction sitting open), then `raise` so the error still surfaces (Flask will turn it into a `500`) instead of being silently swallowed.

**The two interest-update branches.** If the request included an `interestId`, that *specific* interest row is marked `fulfilled` — useful when an admin is looking at one particular request in a list. If not, the code falls back to fulfilling *any* `pending` interest from that user — handy for quick manual assigns where you already know who gets the space but didn't look up their interest row's id.

**The response is a minimal echo, not the full assignment row.** `{"data": {"space_id", "user_id", "interest_id"}}` — the caller already knows what it asked for; the UI re-fetches `GET /api/lots/:id/spaces` (B4) to see the updated space with its `assigned_user_name`.

**`move_assignment` (`webapp/App/views/assignments.py:93-138`) — reassigning a lot, not a spot.** This is the endpoint the brief calls "move": an admin picks up a student who already holds a space and sends their request to a *different lot* — without picking their new spot for them. It frees the source space and clears its roster slot exactly like `delete_assignment` does, then re-queues the occupant's `fulfilled` interest as `pending` with a new `lot_id` and `space_ids` reset to `'{}'` (`:125-128`). If they had no matching `fulfilled` row (`cursor.rowcount == 0`), it inserts a fresh `pending` one instead (`:130-133`) — `ON CONFLICT DO NOTHING` guards against the `one_active_interest_per_user` unique index from B6 in case a pending row already existed. Either way, the *next* step — actually landing them in a spot in `toLotId` — is a normal `POST /api/assignments` call; this endpoint deliberately does not auto-pick one.

**`delete_assignment` (`webapp/App/views/assignments.py:141-173`) — keyed on the SPACE id, not the assignment id.** The URL is `/api/assignments/<int:space_id>` — the path parameter is deliberately named `space_id`. This matches how the UI actually calls it: an admin is looking at a *space* on the map and undoing whatever's assigned to it, not looking up an internal assignment row's id first. `404` ("Assignment not found") fires when that **space** id doesn't exist. Inside the transaction: deactivate the space's active assignment row, free the space, re-queue the student's `fulfilled` interest back to `pending` (**this is new** — the old version of this endpoint left the interest alone; now the student's request re-enters the queue automatically), and clear the roster slot. This flip is a plain one-row `UPDATE fulfilled → pending` with no conflict handling, and it's *safe* precisely because B6 enforces one active request per student: the student can't already have a rival `pending` row, so flipping their `fulfilled` row back can never create a second `pending` one (which would otherwise trip the `one_active_interest_per_user` index with a `500`). Returns `204` — no body, since the caller already knows which space it freed.

**`_label` (`webapp/App/views/assignments.py:176-179`).** A tiny helper that looks up a space's label for building the `"<lot name> · <label>"` roster slot text — kept separate so `create_assignment` doesn't need its own cursor round-trip inline.

### Step 2 — Register the blueprint (~5 min)

Open `webapp/App/__init__.py` and add, alongside the other blueprint registrations:

```python
    from .views import assignments
    app.register_blueprint(assignments.bp)
```

**Why:** exactly like every earlier view module (health, auth, lots, spaces, interest) — Flask only knows about routes in a file once you register that file's blueprint with the app. Register only `assignments` here — the all-at-once registration you may see elsewhere in the shipped app is a later, PoC-local shortcut, not part of this CR. Forget this line and `POST /api/assignments` will 404 as if the route doesn't exist, even though the file is right there. → Reference: [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

---

## 🧪 Prove it works — testing guide

**Setup:** server running, database seeded (B2); `$A` = admin token (B3). The seed data gives you a ready-made scenario: **Bob** (`STU002`, user id `3`) has a `pending` interest request (id `2`) on **Lot 4** (lot id `2`), and Lot 4's first space (`4-1`, space id `9`) is `available`.

**1. Assign the available Lot 4 spot to Bob:**

**macOS / Linux**

```bash
curl -i -X POST http://localhost:8000/api/assignments \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"spaceId":9,"userId":3,"interestId":2}'
# 201 {"data":{"space_id":9,"user_id":3,"interest_id":2}}
curl -s http://localhost:8000/api/lots/2/spaces -H "Authorization: Bearer $A"
# space 9 ("4-1") is now "assigned", assigned_user_id 3, assigned_user_name "Bob"
curl -s "http://localhost:8000/api/interest?status=fulfilled" -H "Authorization: Bearer $A"
# interest id 2 (Bob) is now "fulfilled"
curl -s http://localhost:8000/api/students?q=STU002 -H "Authorization: Bearer $A"
# Bob's roster row: assigned_slot "Lot 4 · 4-1", parking_status "valid"
```

**Windows (PowerShell)** — `Invoke-RestMethod` throws on 4xx/5xx by default; add `-SkipHttpErrorCheck` (PowerShell 7.4+) to see the response body for the error-case steps below, the way `curl -i` does:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/assignments -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' `
  -Body '{"spaceId":9,"userId":3,"interestId":2}'
# 201 {"data":{"space_id":9,"user_id":3,"interest_id":2}}
Invoke-RestMethod http://localhost:8000/api/lots/2/spaces -Headers @{Authorization="Bearer $A"}
# space 9 ("4-1") is now "assigned", assigned_user_id 3, assigned_user_name "Bob"
Invoke-RestMethod "http://localhost:8000/api/interest?status=fulfilled" -Headers @{Authorization="Bearer $A"}
# interest id 2 (Bob) is now "fulfilled"
Invoke-RestMethod "http://localhost:8000/api/students?q=STU002" -Headers @{Authorization="Bearer $A"}
# Bob's roster row: assigned_slot "Lot 4 · 4-1", parking_status "valid"
```

**2. Re-assigning the same space fails:**

**macOS / Linux**

```bash
curl -i -X POST http://localhost:8000/api/assignments \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"spaceId":9,"userId":5}'
# 409 {"error":{"code":"conflict","message":"Space already has an active assignment"}}
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/assignments -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"spaceId":9,"userId":5}'
# 409 {"error":{"code":"conflict","message":"Space already has an active assignment"}}
```

**3. Undo it — DELETE by SPACE id, not assignment id:**

**macOS / Linux**

```bash
curl -i -X DELETE http://localhost:8000/api/assignments/9 -H "Authorization: Bearer $A"
# 204, no body
curl -s http://localhost:8000/api/lots/2/spaces -H "Authorization: Bearer $A"
# space 9 is "available" again, assigned_user_id null
curl -s "http://localhost:8000/api/interest?status=pending" -H "Authorization: Bearer $A"
# Bob's request (id 2) is back to "pending"
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod -Method Delete http://localhost:8000/api/assignments/9 -Headers @{Authorization="Bearer $A"}
# 204, no body
Invoke-RestMethod http://localhost:8000/api/lots/2/spaces -Headers @{Authorization="Bearer $A"}
# space 9 is "available" again, assigned_user_id null
Invoke-RestMethod "http://localhost:8000/api/interest?status=pending" -Headers @{Authorization="Bearer $A"}
# Bob's request (id 2) is back to "pending"
```

**4. Move a fulfilled occupant to a different lot.** The seed's own Alice/`A8` assignment (space id `8`, Lot 1) is a ready-made "already assigned" occupant — move her to Lot 5 (lot id `3`) instead of first creating a new assignment:

**macOS / Linux**

```bash
curl -i -X POST http://localhost:8000/api/assignments/move \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"fromSpaceId":8,"toLotId":3}'
# 200 {"data":{"from_space_id":8,"to_lot_id":3}}
curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"
# space 8 ("A8") is "available" again
curl -s "http://localhost:8000/api/interest?status=pending" -H "Authorization: Bearer $A"
# Alice's request is now "pending" with lot_id 3 (Lot 5) — no spot picked yet
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/assignments/move -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"fromSpaceId":8,"toLotId":3}'
# 200 {"data":{"from_space_id":8,"to_lot_id":3}}
Invoke-RestMethod http://localhost:8000/api/lots/1/spaces -Headers @{Authorization="Bearer $A"}
# space 8 ("A8") is "available" again
Invoke-RestMethod "http://localhost:8000/api/interest?status=pending" -Headers @{Authorization="Bearer $A"}
# Alice's request is now "pending" with lot_id 3 (Lot 5) — no spot picked yet
```

**What you should see:**
- Step 1 → `201`; space `9` becomes `assigned`; Bob's interest becomes `fulfilled`; his roster row shows the new slot and `valid`.
- Step 2 → `409` (already `assigned`, not `available`).
- Step 3 → `204`; the space is `available` again; Bob's request is `pending` again.
- Step 4 → `200`; Alice's space is freed; her request re-enters the queue `pending` **in the target lot**, waiting for an admin to assign her an actual spot there.
- (As with every earlier CR) a student token on any of these routes, or an admin token where a student route is expected, → `403`.

**☁️ Cloud check (optional):** after `./release.sh backend`, run the same assign → read → fulfilled → delete → move sequence against `http://<ElasticIp>`. With B7 deployed, the **whole backend is live in the cloud** — this is a good moment to run the full two-window browser story from the backend guide's Part 1E against the deployed site (`./release.sh all`) as your real end-to-end cloud test.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B7: transactional assign, move, and unassign (with roster sync)"
git push -u origin cr/b7-assignments
```

Then open a Pull Request on GitHub with **base = `cr/b6-interest`** (this CR stacks on B6, not `main` — see the [stacked-CR branching strategy](../../plan.md#81-cr-workflow--branching-strategy)). Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`POST /api/assignments` returns `404` even though you registered the blueprint** — double-check the import line is inside `create_app()` in `__init__.py`, in the same indentation block as the other blueprint registrations, and that you restarted `flask run` after editing.
- **You get `409` on your *first* attempt, not the second** — the space you picked probably isn't `status='available'` already (maybe it was disabled in B5, or assigned by an earlier test run). `GET /api/lots/2/spaces` to check its current status, or pick a different space id.
- **`DELETE /api/assignments/<id>` returns `404` and you're sure the assignment exists** — remember the path parameter is a **space** id, not an assignment table id. Look up the space's id from `GET /api/lots/:id/spaces`, not from an `assignments` row.
- **`interest` never flips to `fulfilled`** — confirm the student actually has a `pending` row for that exact `user_id` (B6's `POST /api/interest`), and that you didn't pass a mismatched `interestId` in the body — if it's provided, only *that* row is updated, not "any pending row from this user."
- **Roster row never picks up the slot** — `_set_roster_slot` only writes if `_resolve_student_id` finds a matching `students.student_id`. If the assigned user's `code` (or the seed's roster `student_id`) doesn't match any roster row, the sync is silently skipped — check the roster with `GET /api/students?q=<name>`.
- **`move` returns `409` on the *source* space** — the space must currently be `status='assigned'`; you can't move a space that has no occupant. `GET /api/lots/:id/spaces` to confirm.
- **A crash midway through testing leaves the space `assigned` but no matching row shows up in `assignments`, or the roster is out of sync with the space** — that would mean the transaction isn't set up the way this lesson shows. Re-check that every `cursor.execute(...)` for one request is inside the *same* `with connection.cursor() as cursor:` block, and that `connection.commit()` only runs after all of them, not after each one.
- **`AttributeError` or `KeyError` on `g.user["id"]`** — this means `@require_role("admin")` didn't run (or your token is missing/expired). Get a fresh admin token from B3's login endpoint and try again.

---

## 📝 Recap

- You wrapped several related writes — insert an assignment, update a space, update an interest, sync a roster row — in **one database transaction**, so they succeed or fail as a single unit.
- You learned **atomicity** (the "A" in ACID) and practiced it with `connection.commit()` / `connection.rollback()` via psycopg, instead of the single-statement `query()`/`execute()` helpers you'd used in every earlier lesson.
- You caught a specific database error (`psycopg.errors.UniqueViolation`) to turn a constraint violation into a clean `409` instead of a crash.
- You built the **move** endpoint — free a space, re-queue the occupant's request in a different lot, without auto-picking their next spot.
- You built the undo path (`DELETE`, keyed on the **space** id) with the same transactional pattern, and had it re-open the student's request automatically.

---

## 📚 References

- [PostgreSQL — Transactions tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html).
- [Wikipedia — ACID](https://en.wikipedia.org/wiki/ACID) — atomicity, consistency, isolation, durability.
- [PostgreSQL — `BEGIN`](https://www.postgresql.org/docs/current/sql-begin.html), [`COMMIT`](https://www.postgresql.org/docs/current/sql-commit.html), [`ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html).
- [psycopg3 documentation — Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- [MDN — HTTP `DELETE`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE).
- [Wikipedia — Denormalization](https://en.wikipedia.org/wiki/Denormalization) — why the roster sync exists.
- [Flask — Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).
- [plan.md §8.1 — CR workflow & branching strategy](../../plan.md#81-cr-workflow--branching-strategy).
- Source of truth for this lesson: [backend guide → CR B7](../backend-development-guide.md#cr-b7--admin-assigns-a-space).

---

## ➡️ Next lesson

**[Lesson B8 — Save a lot's spot layout](B8-save-lot-layout.md).** You'll reuse this lesson's one-transaction pattern for a different kind of write: reconciling a whole set of spot positions — add, move, delete — in a single request. → [source CR](../backend-development-guide.md#cr-b8--save-lot-layout-spot-positions).
