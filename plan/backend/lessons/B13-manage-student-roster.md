# Lesson B13 — Manage the student roster (CRUD, CSV import, and direct assign) — *extension*

> **Track:** Backend · **Extension lesson** (built during the PoC, beyond the core B0–B9)
> **⏱ Time:** ~75 min · **🎚 Difficulty:** moderate–hard (a full admin CRUD surface, a server-side CSV parser, and a two-identity assignment transaction — but every piece reuses a pattern from an earlier lesson)
> **🧩 Prerequisites:** you've done [Lesson B9 — Create a parking lot](B9-create-a-lot.md) (the last of the core CRs) and [Lesson B7 — Admin assigns a space](B7-admin-assigns-a-space.md) (the transaction pattern this lesson reuses).
> **🌿 CR branch:** `cr/b13-student-roster` (off `cr/b9-create-lot`) · **🗺 Big picture:** [plan.md §5.1](../../plan.md#51-data-model-entities), [§6.5](../../plan.md#65-extension-flows-surfaced-by-the-poc-roster-withdraw-move), and the tracker rows [B13/B14 in §8.2](../../plan.md#82-cr-status-tracker)

---

> **New words ahead?** Terms like [JWT](GLOSSARY.md#jwt), [CSV](GLOSSARY.md#csv), and [Upsert](GLOSSARY.md#upsert) link to the shared [**Glossary**](GLOSSARY.md) the first time each lesson uses them — one plain-language sentence per word. Click through whenever a word is new; you never have to memorize one before the lesson needs it.

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

Every lesson so far manages *parking* data — lots, spaces, interest, assignments. This lesson adds a second kind of data the school office already owns: a **student roster** — every student's name, grade, contact email, and current parking status — kept as its own admin-managed table, separate from the login `users` table.

By the end of this lesson, an **admin** [token](GLOSSARY.md#jwt) can:

- **List and search** the roster (`GET /api/students?q=`).
- **Add, edit, and delete** a roster row (`POST` / `PATCH` / `DELETE /api/students`).
- **Bulk-import a [CSV](GLOSSARY.md#csv)** that *[upserts](GLOSSARY.md#upsert)* the roster by student ID **and provisions a login** for each student (`POST /api/students/import`).
- **Assign a roster student directly to a spot** — even one who has never logged in or filed a request (`POST /api/students/:id/assign`) — reusing B7's [transaction](GLOSSARY.md#transaction) pattern.

**🖼 Before → after — what the API does:**

```text
BEFORE  — no roster surface at all; student data (if any) lives only in the login `users` table
  $ curl -i http://localhost:8000/api/students
  HTTP/1.1 404 NOT FOUND
  {"error":{"code":"not_found","message":"Not found"}}

AFTER   — full CRUD, a CSV upsert-import, and a direct-assign move, all on their own admin-managed table
  $ curl -s "http://localhost:8000/api/students?q=alice" -H "Authorization: Bearer $A"
  {"data":[{"id":1,"first":"Alice","last":"Anderson","student_id":"STU001",
            "grade":"11","assigned_slot":"Lot 1 · A8","parking_status":"valid"}]}

  $ curl -i -X POST http://localhost:8000/api/students/import \
      -H "Authorization: Bearer $A" -F "file=@roster.csv"
  HTTP/1.1 200 OK
  {"data":{"added":1,"updated":1,"errors":["Row 3: need First, Last and studentId"]}}

  $ curl -i -X POST http://localhost:8000/api/students/2/assign \
      -H "Authorization: Bearer $A" -d '{"spaceId":9}'
  HTTP/1.1 200 OK
  {"data":{"id":9,"status":"assigned","assigned_student_id":"STU002",...}}
```

**✅ Done when (your deliverable checklist):**
- [ ] `GET /api/students?q=an` (admin token) returns only students whose name or student ID matches, ordered last-then-first.
- [ ] `POST /api/students` with a new `student_id` returns `201`; the same `student_id` again returns `409`; a missing `first`/`last`/`student_id` returns `400`.
- [ ] `PATCH /api/students/:id` edits a subset of fields, rejects a blank `student_id` with `400`, and rejects a duplicate `student_id` with `409`.
- [ ] `DELETE /api/students/:id` returns `204`, and `404` for an unknown id.
- [ ] `POST /api/students/:id/assign {"spaceId": N}` places the student in an `available` space, frees any spot they already held first, and — if a matching login exists — links and fulfils their interest too.
- [ ] `POST /api/students/import` with a CSV upserts by `student_id` and reports `{added, updated, errors}` without failing the whole file on one bad row.
- [ ] After an import, each imported student can sign in via `POST /api/auth/student` with their `student_id` as the code — the import provisions a login, not just a roster row.
- [ ] A student token gets `403` on every one of these routes — the roster is admin-only, full stop.
- [ ] Your work is committed on branch `cr/b13-student-roster` and pushed, PR base = `cr/b9-create-lot`.

---

## 🤔 Why this lesson matters

Every entity you've built so far — `lots`, `spaces`, `interest`, `assignments` — is data the *app* invented. The roster is different: it's data the school **already has**, in a spreadsheet, before your app existed. Two ideas make that difference concrete:

- **A business key, not just a surrogate id.** The roster is looked up by the school's own `student_id` (`STU001`), not the database's auto-increment `id` (its [primary key](GLOSSARY.md#primary-key)). That's the value a CSV import matches rows on, and the value that links a roster row to a login account (`users.code == students.student_id`) — see `webapp/App/views/students.py:122-124`. Get the key wrong and an import can't tell "update this student" from "add a duplicate."
- **Two identities can hold one spot.** A roster student might have no login `users` row at all — Sarah Smith (`S123213`) in the seed is one, and so is anyone an admin adds via `POST /api/students`. (The one exception is CSV import, which *provisions* a login for each row — see Step 4.) So `spaces` carries **two** nullable foreign-ish columns: `assigned_user_id` (the login, may be `NULL`) and `assigned_student_id` (the roster, by `student_id`). The assign [endpoint](GLOSSARY.md#endpoint) in this lesson (`students.py:106-170`) is the one place that has to reconcile both identities in a single transaction — for a login-less roster student it sets only `assigned_student_id`.

This also finishes a gap B7 left open: B7's `POST /api/assignments` is keyed by `userId` and works cleanest once the student has *filed an interest request*. A roster-only student (Sarah, no login) can't be named by `userId` at all; and even a CSV-imported student — who now *does* have a login — still hasn't filed a request, and the admin is working from the roster's numeric `id`, not a `userId`. `POST /api/students/:id/assign` is the direct-placement path for all of them: it takes the roster `id`, links a login if one exists, and fulfils an interest row only when there is one.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Business key vs surrogate key** | The roster is looked up by the school's `student_id`, not the DB's auto-increment `id` — the business key is what an import and a login link both match on. | [Wikipedia: Natural key](https://en.wikipedia.org/wiki/Natural_key) |
| **Upsert** | "Update if a row with this key exists, else insert" — how CSV import merges into the roster without creating duplicates. | [Wikipedia: Merge (upsert)](https://en.wikipedia.org/wiki/Merge_(SQL)) |
| **Multipart file upload (server side)** | Reading an uploaded file from `request.files` instead of `request.get_json()` — the request body isn't JSON, it's a file plus form fields. | [Flask: Uploading Files](https://flask.palletsprojects.com/en/stable/patterns/fileuploads/) |
| **Partial update (`PATCH`)** | Applying *only the fields present in the body* instead of requiring the whole resource, so an admin can fix one column without resending everything. | [MDN: PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) |
| **Database transaction (reused from B7)** | Grouping the "free the old spot, take the new one, sync the roster" writes into one all-or-nothing unit. | [Lesson B7](B7-admin-assigns-a-space.md#-build-it-step-by-step) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, list + search (8) → Step 2, create + update + delete (15) → Step 3, direct assign — the transaction (20) → Step 4, CSV import (15) → register the blueprint (2) → local testing (10).

**You need, from earlier lessons:** the server running locally (B1), the schema seeded (B2) — the `students` table already exists from `001_init.sql`, this lesson adds no migration — and the admin login (B3). You'll also lean on the shared `serialize.py` module introduced in B4: this lesson's `assign` endpoint reuses `serialize.SPACE_SELECT` and `serialize.space()` (`webapp/App/serialize.py:10-18,53-68`) exactly as B7 did, plus a new `serialize.student()` (`webapp/App/serialize.py:87-98`) for every other [response](GLOSSARY.md#response).

**Branch off B9** (the last core lesson; B13 stacks after B9, not on `main`):

```bash
git checkout cr/b9-create-lot
git checkout -b cr/b13-student-roster
```

---

## 🛠 Build it, step by step

### Step 1 — List and search the roster (~10 min)

Create `webapp/App/views/students.py`:

```python
import csv
import io

from flask import Blueprint, request, jsonify, g

from ..db import query, query_one, get_db
from ..auth import require_role
from .. import serialize

bp = Blueprint("students", __name__)             # same Blueprint pattern every feature area uses (see B1)

VALID_PARKING = {"unassigned", "valid", "expired", "suspended"}   # legal parking_status values (Step 2)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status   # shared error envelope helper


def _student_by_id(student_pk):
    return query_one("SELECT * FROM students WHERE id = %s", (student_pk,))   # lookup is always by numeric id


@bp.get("/api/students")                         # GET /api/students?q= — list or search the roster
@require_role("admin")                           # roster routes are admin-only, no student surface
def list_students():
    term = (request.args.get("q") or "").strip().lower()   # ?q= search term, lowercased
    if term:
        pattern = f"%{term}%"                    # substring match, used on both sides of the OR below
        rows = query(
            "SELECT * FROM students "
            "WHERE lower(first || ' ' || last) LIKE %s OR lower(student_id) LIKE %s "
            "ORDER BY lower(last), lower(first)", (pattern, pattern))
    else:
        rows = query("SELECT * FROM students ORDER BY lower(last), lower(first)")   # no q= → full roster
    return jsonify({"data": [serialize.student(row) for row in rows]})   # {"data": [...]} envelope
```
(`webapp/App/views/students.py:1-36`)

**Why it works & further reading:**
- **`_student_by_id`** is a tiny helper called from four other handlers below — the roster's path param is always the numeric `id`, never `student_id`, so this centralizes that lookup once.
- **The search** matches **either** `"first last"` **or** `student_id`, both `LIKE`'d case-insensitively via `lower(...)` on both sides — that's how a search for `"stu"` or `"alice"` both work from the same [query parameter](GLOSSARY.md#query-parameter). Ordering by `lower(last), lower(first)` (not `id`) is what makes the roster read like an office's alphabetized class list.
- **`@require_role("admin")`** gates every handler in this file by [role](GLOSSARY.md#role) — the same guard every admin-only route in this backend uses.
- **The `{"data": ...}` [envelope](GLOSSARY.md#envelope)** — every success response here wraps its payload in `data`, exactly like every other endpoint since B1.

### Step 2 — Create, update, delete (~18 min)

```python
@bp.post("/api/students")                        # POST /api/students — create a roster row
@require_role("admin")
def create_student():
    body = request.get_json(silent=True) or {}
    first = (body.get("first") or "").strip()
    last = (body.get("last") or "").strip()
    student_id = (body.get("student_id") or "").strip()
    if not first or not last or not student_id:
        return _err("bad_request", "first, last and student_id are required", 400)   # 400: missing fields
    if query_one("SELECT id FROM students WHERE lower(student_id) = lower(%s)", (student_id,)):
        return _err("conflict", f"Student id {student_id} already exists", 409)   # 409: duplicate business key

    row = query_one(
        "INSERT INTO students (first, last, student_id, email, grade) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (first, last, student_id, (body.get("email") or "").strip(), (body.get("grade") or "").strip()))
    get_db().commit()
    return jsonify({"data": serialize.student(row)}), 201   # 201: created


@bp.patch("/api/students/<int:student_pk>")      # PATCH /api/students/:id — partial update
@require_role("admin")
def update_student(student_pk):
    student = _student_by_id(student_pk)
    if student is None:
        return _err("not_found", "Student not found", 404)

    body = request.get_json(silent=True) or {}
    updates = {}                                 # only fields actually present in the body get touched
    if body.get("student_id") is not None:
        next_student_id = str(body["student_id"]).strip()
        if not next_student_id:
            return _err("bad_request", "student_id cannot be blank", 400)
        clash = query_one(
            "SELECT id FROM students WHERE id <> %s AND lower(student_id) = lower(%s)",
            (student_pk, next_student_id))
        if clash:
            return _err("conflict", f"Student id {next_student_id} already exists", 409)
        updates["student_id"] = next_student_id
    for field in ("first", "last", "email", "grade"):
        if body.get(field) is not None:
            updates[field] = str(body[field]).strip()
    if body.get("parking_status") is not None and body["parking_status"] in VALID_PARKING:
        updates["parking_status"] = body["parking_status"]   # unknown status is silently dropped, not 400

    if updates:
        columns = ", ".join(f"{name} = %s" for name in updates)   # build UPDATE ... SET col=%s, col=%s ...
        values = list(updates.values()) + [student_pk]
        connection = get_db()
        with connection.cursor() as cursor:
            cursor.execute(f"UPDATE students SET {columns} WHERE id = %s", values)
        connection.commit()
    return jsonify({"data": serialize.student(_student_by_id(student_pk))})


@bp.delete("/api/students/<int:student_pk>")     # DELETE /api/students/:id — remove a roster row
@require_role("admin")
def delete_student(student_pk):
    if _student_by_id(student_pk) is None:
        return _err("not_found", "Student not found", 404)
    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM students WHERE id = %s", (student_pk,))   # no assignment check — see below
    connection.commit()
    return "", 204                               # 204: deleted, no body
```
(`webapp/App/views/students.py:39-103`)

**Why it works & further reading:**
- **Create** re-checks `student_id` uniqueness with `lower(...)` on both sides — the same case-insensitive duplicate check you built for lot names in B9, applied to the roster's business key instead.
- **Update builds a `dict` of only the fields present in the body**, then turns that dict into one dynamic `UPDATE ... SET col = %s, col = %s ...` — that's what makes it a true [PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH): send `{"grade": "12"}` alone and only `grade` changes. `parking_status` gets one extra guard — `if ... in VALID_PARKING` — so a typo'd status is **silently dropped**, not rejected; only `student_id` blank/duplicate returns an error.
- **Delete is intentionally simple** — `404` if the row doesn't exist, else a plain `DELETE`. **Unlike `DELETE /api/lots/:id` (B9), this endpoint does not check whether the student currently holds an assignment** — deleting a student who has a spot leaves that spot's `assigned_student_id` pointing at a `student_id` that no longer exists in the roster (the space itself doesn't change). That's a real gap, not a documentation error: file it under [plan.md R9](../../plan.md#12-risks--mitigations) rather than assuming a `409` here.

### Step 3 — Direct assign: the two-identity transaction (~20 min)

```python
@bp.post("/api/students/<int:student_pk>/assign")   # POST /api/students/:id/assign — direct placement
@require_role("admin")
def assign_student(student_pk):
    student = _student_by_id(student_pk)
    if student is None:
        return _err("not_found", "Student not found", 404)
    body = request.get_json(silent=True) or {}
    space_id = body.get("spaceId")
    if not isinstance(space_id, int):
        return _err("bad_request", "spaceId (integer) is required", 400)
    space = query_one("SELECT id, lot_id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if space["status"] != "available":
        return _err("conflict", "Space is not available", 409)   # 409: space already taken

    student_code = student["student_id"]
    login = query_one("SELECT id FROM users WHERE code = %s", (student_code,))   # link by users.code == student_id
    login_id = login["id"] if login else None    # None when the roster student has no login at all
    held = query(
        "SELECT id, lot_id FROM spaces "
        "WHERE status='assigned' AND (assigned_student_id=%s OR assigned_user_id=%s)",
        (student_code, login_id))                # check both identity columns

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            # Free any spot the student already holds, so this becomes a MOVE.
            for previous in held:
                cursor.execute(
                    "UPDATE assignments SET active=FALSE WHERE space_id=%s AND active", (previous["id"],))
                cursor.execute(
                    "UPDATE spaces SET status='available', assigned_user_id=NULL, "
                    "assigned_student_id=NULL WHERE id=%s", (previous["id"],))
                if login_id is not None:
                    cursor.execute(
                        "UPDATE interest SET status='pending' "
                        "WHERE user_id=%s AND lot_id=%s AND status='fulfilled'",
                        (login_id, previous["lot_id"]))
            # Assign the new space to the roster student (and login user if any).
            cursor.execute(
                "UPDATE spaces SET status='assigned', assigned_student_id=%s, assigned_user_id=%s "
                "WHERE id=%s", (student_code, login_id, space_id))
            if login_id is not None:
                cursor.execute(
                    "INSERT INTO assignments (space_id, user_id, assigned_by, active) "
                    "VALUES (%s, %s, %s, TRUE)", (space_id, login_id, g.user["id"]))
                cursor.execute(
                    "UPDATE interest SET lot_id=%s, status='fulfilled' "
                    "WHERE user_id=%s AND status='pending'", (space["lot_id"], login_id))
            cursor.execute("SELECT name FROM lots WHERE id=%s", (space["lot_id"],))
            lot_row = cursor.fetchone()
            cursor.execute("SELECT label FROM spaces WHERE id=%s", (space_id,))
            label = cursor.fetchone()["label"]
            lot_name = lot_row["name"] if lot_row else f"Lot {space['lot_id']}"
            cursor.execute(                       # keep the roster row in sync with the space it now holds
                "UPDATE students SET assigned_slot=%s, parking_status='valid' WHERE id=%s",
                (f"{lot_name} · {label}", student_pk))
        connection.commit()                       # all writes land together
    except Exception:
        connection.rollback()                     # or none do
        raise

    row = query_one(serialize.SPACE_SELECT + " WHERE s.id = %s", (space_id,))   # re-read the space, not the student
    return jsonify({"data": serialize.space(row)})
```
(`webapp/App/views/students.py:106-170`)

**Why it works & further reading:**
- **Validate, then resolve the login link.** `spaceId` must be an `int`, the space must exist and be `available` — the same fail-fast-before-the-transaction shape as B7. Then `login = query_one("SELECT id FROM users WHERE code = %s", (student_code,))` implements the convention from plan.md §5.1: *if some login's `code` equals this student's `student_id`, they're the same person.* `login_id` stays `None` when there's no such account — the transaction below has to work either way.
- **Find every spot this identity already holds, by both paths.** `held` queries `assigned_student_id=%s OR assigned_user_id=%s` — you have to check both columns, because a student who's logged in could theoretically be tracked by either. This is what turns the endpoint into a **move**, not just an assign: whatever it finds gets freed first.
- **The transaction — same shape as B7, one more branch:**
```python
connection = get_db()
try:
    with connection.cursor() as cursor:
        for previous in held: ...   # 1. free every previously-held spot
        cursor.execute(...)          # 2. assign the new spot to student_code (+ login_id)
        if login_id is not None: ... # 3. record an assignments row + fulfil interest
        cursor.execute(...)          # 4. sync assigned_slot + parking_status on the roster row
    connection.commit()
except Exception:
    connection.rollback()
    raise
```
  Every one of those writes has to land together — a crash after step 2 but before step 4 would leave a space `assigned` while the roster still says `unassigned`, exactly the kind of drift B7 taught you a transaction prevents. → Reference: [Lesson B7 — the transaction](B7-admin-assigns-a-space.md#-build-it-step-by-step).
- **Why the response is a *space*, not a *student*.** The endpoint re-reads the space through `serialize.SPACE_SELECT` / `serialize.space()` — the exact shared [serializer](GLOSSARY.md#serialization) B4 introduced and B7 reused — so the caller sees the same shape `GET /api/lots/:id/spaces` returns, including the freshly-set `assigned_student_id` and the `assigned_user_name` the `SPACE_SELECT` join computes via `COALESCE(u.name, st.first || ' ' || st.last)` (`serialize.py:14`) — that `COALESCE` is precisely what lets a roster-only student (no login) still show a name on the map.

### Step 4 — CSV import: upsert with per-row errors (~15 min)

```python
@bp.post("/api/students/import")                 # POST /api/students/import — CSV upsert
@require_role("admin")
def import_students():
    uploaded = request.files.get("file")          # multipart file part, not JSON
    if uploaded is None or not uploaded.filename:
        return _err("bad_request", "a CSV file is required", 400)
    text = uploaded.read().decode("utf-8-sig", errors="replace")   # utf-8-sig strips Excel's BOM
    rows = [row for row in csv.reader(io.StringIO(text)) if any(cell.strip() for cell in row)]
    if not rows:
        return _err("bad_request", "The CSV file is empty", 400)
    # Skip a header row if the first two columns look like First,Last.
    if len(rows[0]) >= 2 and rows[0][0].strip().lower() == "first" and rows[0][1].strip().lower() == "last":
        rows = rows[1:]

    added = 0
    updated = 0
    errors = []                                  # per-row problems, collected instead of raised
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            for index, cells in enumerate(rows):
                first = cells[0].strip() if len(cells) > 0 else ""
                last = cells[1].strip() if len(cells) > 1 else ""
                student_id = cells[2].strip() if len(cells) > 2 else ""
                email = cells[3].strip() if len(cells) > 3 else ""
                grade = cells[4].strip() if len(cells) > 4 else ""
                if not first or not last or not student_id:
                    errors.append(f"Row {index + 1}: need First, Last and studentId")
                    continue                      # skip this row only, keep processing the rest
                cursor.execute(
                    "SELECT id FROM students WHERE lower(student_id) = lower(%s)", (student_id,))
                existing = cursor.fetchone()
                if existing:
                    cursor.execute(
                        "UPDATE students SET first=%s, last=%s, email=%s, grade=%s WHERE id=%s",
                        (first, last, email, grade, existing["id"]))
                    updated += 1
                else:
                    cursor.execute(
                        "INSERT INTO students (first, last, student_id, email, grade) "
                        "VALUES (%s, %s, %s, %s, %s)", (first, last, student_id, email, grade))
                    added += 1
                # Provision the student's (non-admin) login account so an imported
                # student can sign in with their student_id as their code. The
                # users row holds only login identity (role, code, name); all
                # student metadata lives in the students table. Upsert by code so
                # re-importing the same student never duplicates the login.
                cursor.execute(
                    "INSERT INTO users (role, code, name) "
                    "VALUES ('student', %s, %s) "
                    "ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name",
                    (student_id, f"{first} {last}"))
        connection.commit()                       # one commit for the whole file
    except Exception:
        connection.rollback()
        raise
    return jsonify({"data": {"added": added, "updated": updated, "errors": errors}})
```
(`webapp/App/views/students.py:173-229`)

**Why it works & further reading:**
- **`request.files.get("file")`, not `request.get_json()`.** A CSV upload arrives as `multipart/form-data`; Flask parses that into `request.files` (the file part) and `request.form` (any plain fields) — completely separate from the JSON body every other endpoint in this app reads. → Reference: [Flask: Uploading Files](https://flask.palletsprojects.com/en/stable/patterns/fileuploads/).
- **`decode("utf-8-sig", ...)`** strips a byte-order-mark that Excel sometimes prepends to a CSV export — without it, the first header cell would read as `"﻿first"` and the header-skip check below would silently miss.
- **The header row is optional, not required.** The code only drops `rows[0]` if it *looks like* a header (`"first","last"` case-insensitively) — a file with no header row still imports correctly, first row and all.
- **Every row is independent.** A row missing `first`/`last`/`student_id` is appended to `errors` and `continue`s to the next row — it does **not** raise, and it does **not** abort the loop. That's the difference between this import and a naive "parse the whole file or reject it" approach: one bad row among two hundred good ones costs you one error message, not the other 199 rows.
- **Upsert, by the business key, one row at a time.** Each row does its own `SELECT ... WHERE lower(student_id) = lower(%s)` to decide `UPDATE` vs `INSERT` — applied row-by-row inside the same transaction as the rest of the import.
- **Import provisions the login, not just the roster.** After each roster row, the same loop upserts a `users` row (`role='student'`, `code=student_id`, `name`) with `ON CONFLICT (code) DO UPDATE` — so a student loaded from the CSV can immediately sign in via `POST /api/auth/student` with their `student_id` as their code. The `users` row deliberately holds **only login identity**; every piece of student metadata (email, grade, parking status, assigned slot) lives in `students`, never duplicated into `users`. Because the login is keyed on `code` and the roster on `student_id`, re-importing the same file updates both in place instead of creating duplicate logins.
- **One transaction for the whole file.** All the `INSERT`/`UPDATE` statements share one `with connection.cursor()` block and one `connection.commit()` at the end — if something throws partway through (a database-level error, not a per-row validation miss), the whole import rolls back rather than leaving the roster half-updated.

> **📸 Note — `GET /api/students/export` is *not* built.** The plan's original API surface listed a CSV export endpoint alongside import. It was never implemented in this PoC — `students.py` has no export route. If a future CR adds it, treat it as new work, not something this lesson already shipped.

### Step 5 — Register the blueprint (~2 min)

Open `webapp/App/__init__.py` and add, alongside the other blueprint registrations:

```python
    from .views import students
    app.register_blueprint(students.bp)   # same registration every blueprint gets (health, lots, spaces, ...)
```

**Why:** identical to every earlier CR — Flask never sees a route until its blueprint is registered with the app. Skip this line and every `/api/students...` route 404s as if the file doesn't exist. → Reference: [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

---

## 🧪 Prove it works — testing guide

**Setup:** server running with the seeded database; `$A` = admin token, `$S` = a student token (either fails every route below with `403`). The seed roster ([plan.md §2](../../plan.md#2-what-we-have-in-the-ui-today)) gives you: **Alice Anderson / `STU001`** (grade 11, slot `"Lot 1 · A8"`, `parking_status: valid`), **Sarah Smith / `S123213`** (grade 10, `suspended`), plus Bob (`STU002`), Andrew (`STU003`), Olivia (`STU004`), all `unassigned`.

**macOS / Linux**

```bash
# Search by name and by student id — both should return Alice alone.
curl -s "http://localhost:8000/api/students?q=alice" -H "Authorization: Bearer $A"
curl -s "http://localhost:8000/api/students?q=S123213" -H "Authorization: Bearer $A"

# Create — then repeat the same student_id for a 409.
curl -i -X POST http://localhost:8000/api/students \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"first":"New","last":"Kid","student_id":"STU010","grade":"9"}'
curl -i -X POST http://localhost:8000/api/students \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"first":"Dup","last":"Licate","student_id":"STU010"}'   # -> 409

# Patch a subset of fields; blank student_id -> 400.
curl -i -X PATCH http://localhost:8000/api/students/6 \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"grade":"10"}'
curl -i -X PATCH http://localhost:8000/api/students/6 \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"student_id":""}'   # -> 400

# Direct assign — Bob (STU002, no request filed) into an available space in Lot 4.
curl -i -X POST http://localhost:8000/api/students/2/assign \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"spaceId":9}'
# re-read the roster: Bob's parking_status is now "valid", assigned_slot is set.
curl -s "http://localhost:8000/api/students?q=bob" -H "Authorization: Bearer $A"

# Delete.
curl -i -X DELETE http://localhost:8000/api/students/6 -H "Authorization: Bearer $A"   # -> 204
curl -i -X DELETE http://localhost:8000/api/students/6 -H "Authorization: Bearer $A"   # -> 404

# CSV import — one update (Bob, existing STU002), one add (new STU020), one bad row.
cat > /tmp/roster.csv <<'EOF'
First,Last,studentId,email,grade
Bob,Baker,STU002,bob@lt.edu,12
Nora,Newperson,STU020,nora@lt.edu,9
NoStudentId,,,,
EOF
curl -i -X POST http://localhost:8000/api/students/import \
  -H "Authorization: Bearer $A" -F "file=@/tmp/roster.csv"
# -> {"data":{"added":1,"updated":1,"errors":["Row 3: need First, Last and studentId"]}}

# The freshly imported student can now log in — the import provisioned a login row.
curl -i -X POST http://localhost:8000/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU020"}'
# -> 200 with a token and user {name:"Nora Newperson", role:"student", email:null}

# Every route above with $S instead of $A -> 403.
curl -i http://localhost:8000/api/students -H "Authorization: Bearer $S"   # -> 403
```

**Windows (PowerShell)** — `Invoke-RestMethod` throws on 4xx/5xx by default; add `-SkipHttpErrorCheck` (PowerShell 7.4+) to see the response body for the error-case steps below, the way `curl -i` does:

```powershell
# Search by name and by student id — both should return Alice alone.
Invoke-RestMethod "http://localhost:8000/api/students?q=alice" -Headers @{Authorization="Bearer $A"}
Invoke-RestMethod "http://localhost:8000/api/students?q=S123213" -Headers @{Authorization="Bearer $A"}

# Create — then repeat the same student_id for a 409.
Invoke-RestMethod -Method Post http://localhost:8000/api/students -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' `
  -Body '{"first":"New","last":"Kid","student_id":"STU010","grade":"9"}'
Invoke-RestMethod -Method Post http://localhost:8000/api/students -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' `
  -Body '{"first":"Dup","last":"Licate","student_id":"STU010"}'   # -> 409

# Patch a subset of fields; blank student_id -> 400.
Invoke-RestMethod -Method Patch http://localhost:8000/api/students/6 -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"grade":"10"}'
Invoke-RestMethod -Method Patch http://localhost:8000/api/students/6 -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"student_id":""}'   # -> 400

# Direct assign — Bob (STU002, no request filed) into an available space in Lot 4.
Invoke-RestMethod -Method Post http://localhost:8000/api/students/2/assign -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"spaceId":9}'
# re-read the roster: Bob's parking_status is now "valid", assigned_slot is set.
Invoke-RestMethod "http://localhost:8000/api/students?q=bob" -Headers @{Authorization="Bearer $A"}

# Delete.
Invoke-RestMethod -Method Delete http://localhost:8000/api/students/6 -Headers @{Authorization="Bearer $A"}   # -> 204
Invoke-RestMethod -Method Delete http://localhost:8000/api/students/6 -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"}   # -> 404

# CSV import — one update (Bob, existing STU002), one add (new STU020), one bad row.
@'
First,Last,studentId,email,grade
Bob,Baker,STU002,bob@lt.edu,12
Nora,Newperson,STU020,nora@lt.edu,9
NoStudentId,,,,
'@ | Set-Content -Path "$env:TEMP\roster.csv" -Encoding utf8
Invoke-RestMethod -Method Post http://localhost:8000/api/students/import `
  -Headers @{Authorization="Bearer $A"} -Form @{file=Get-Item "$env:TEMP\roster.csv"}
# -> {"data":{"added":1,"updated":1,"errors":["Row 3: need First, Last and studentId"]}}

# The freshly imported student can now log in — the import provisioned a login row.
Invoke-RestMethod -Method Post http://localhost:8000/api/auth/student `
  -ContentType 'application/json' -Body '{"code":"STU020"}'
# -> 200 with a token and user {name:"Nora Newperson", role:"student", email:null}

# Every route above with $S instead of $A -> 403.
Invoke-RestMethod http://localhost:8000/api/students -SkipHttpErrorCheck -Headers @{Authorization="Bearer $S"}   # -> 403
```

**What you should see:**
- The two searches each return exactly Alice's row, sorted last-then-first when there are ties.
- `POST /api/students` — `201` the first time, `409` on the repeat `student_id`.
- `PATCH` — the plain `{"grade":"10"}` succeeds and only `grade` changes; `{"student_id":""}` → `400`.
- The assign call returns a serialized **space** (`200`) with `assigned_student_id: "STU002"`; re-reading the roster shows Bob's `parking_status: "valid"` and a non-null `assigned_slot`.
- `DELETE` → `204` then `404` on the repeat.
- The import summary reports `added: 1, updated: 1`, and the third row's exact error text.
- The follow-up student login for `STU020` returns `200` — the import provisioned a login (with `email: null`, since metadata stays in `students`), so a brand-new imported student can sign in immediately.
- Every call with `$S` → `403`.

**☁️ Cloud check (optional):** after `./release.sh backend`, re-run the assign + import sequence against `http://<ElasticIp>` and confirm the roster and the live map spot colors agree from a second browser.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B13: student roster CRUD + CSV import + direct assign"
git push -u origin cr/b13-student-roster
```

Open a PR with **base = `cr/b9-create-lot`**. Paste your "Prove it works" output. Record the CR's status in [the tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) — B13/B14 are both listed there and this one lesson covers both.

---

## 🧯 If something breaks

- **`/api/students...` 404s even though the file is right there** — you forgot Step 5; check `app.register_blueprint(students.bp)` is inside `create_app()` and you restarted the server.
- **Search returns everything, ignoring `q`** — confirm you're reading `request.args.get("q")`, lowercasing it, and wrapping it in `%...%` for **both** `LIKE` clauses.
- **A duplicate `student_id` crashes with a 500 instead of returning `409`** — you're missing the pre-check `SELECT ... WHERE lower(student_id) = lower(%s)` before the `INSERT`/`UPDATE`; add it back rather than relying on the DB's unique constraint to surface a clean error here (unlike B7, this table has no `try/except psycopg.errors.UniqueViolation`).
- **`PATCH` overwrites fields the caller didn't send** — you're not checking `if body.get(field) is not None:` per field; build the `updates` dict first, then apply only what's in it.
- **Assign says the space is taken (`409`) on your first try** — the space you picked isn't `available`; `GET /api/lots/:id/spaces` to find a free one, or use a space you haven't already assigned in an earlier test.
- **Assign leaves the roster's `parking_status` unchanged** — the final `UPDATE students SET assigned_slot=..., parking_status='valid'` must run *inside* the same `with connection.cursor()` block as the space/assignment writes, and `connection.commit()` only after all of them.
- **CSV import 400s with "empty" on a real file** — check you're sending it as `-F "file=@path"` (multipart), not `-d` (JSON); and that the file isn't only a header row with no data rows.
- **Import fails the entire file on one bad row** — a per-row problem must `errors.append(...)` and `continue`, never `raise`; only a real database error should hit the `except Exception: connection.rollback()` branch.
- **A student token doesn't get `403`** — every handler needs `@require_role("admin")` directly under `@bp....(...)`; check the decorator order and that you have a fresh, non-expired token.

---

## 📝 Recap — what you built and learned

- You added a **second top-level entity** — the roster — that's looked up by a **business key** (`student_id`), not the database `id`, and learned why that's what lets a CSV import and a login-account link both work.
- You built a **partial update** (`PATCH`) that only touches the fields present in the request body.
- You reused **B7's transaction pattern** for a harder case: freeing an old spot, taking a new one, and reconciling **two separate identity columns** (`assigned_user_id`, `assigned_student_id`) in one commit.
- You built a server-side **CSV upsert** that reports per-row errors instead of failing the whole file — the same "meet the data where it is" idea that makes a real office's spreadsheet workflow usable — and had it **provision a login** for every imported student (login identity in `users`, all metadata in `students`) so they can sign in the moment they're on the roster.
- You confirmed (again) that **every admin-only route rejects a student token** — the roster has no student-facing surface at all.

---

## 📚 References

- [Wikipedia — Natural key](https://en.wikipedia.org/wiki/Natural_key) — why the roster is keyed by `student_id`, not the DB id.
- [Wikipedia — Merge (upsert)](https://en.wikipedia.org/wiki/Merge_(SQL)) — update-if-exists-else-insert.
- [Flask — Uploading Files](https://flask.palletsprojects.com/en/stable/patterns/fileuploads/) — `request.files`, multipart parsing.
- [MDN — PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) — partial-update semantics.
- [Lesson B7 — Admin assigns a space](B7-admin-assigns-a-space.md) — the transaction pattern this lesson reuses.
- Big picture: [plan.md §5.1](../../plan.md#51-data-model-entities) (data model), [§6.5](../../plan.md#65-extension-flows-surfaced-by-the-poc-roster-withdraw-move) (extension flows), [§8.2](../../plan.md#82-cr-status-tracker) (CR tracker, rows B13/B14).

---

## ➡️ Next lesson

The roster is admin-only backend plumbing — the UI that drives it is the **[U10 — Student Management lesson](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U10-student-management.md)** (frontend track). If you're staying on the backend, the remaining work is the **Phase 4 hardening pass** (validation polish, automated tests — see [plan.md §8.2](../../plan.md#82-cr-status-tracker)) or the **[Deploy track, starting with Lesson D0](../../deploy/lessons/D0-aws-account-setup.md)**.
