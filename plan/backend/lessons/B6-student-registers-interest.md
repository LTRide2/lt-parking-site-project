# Lesson B6 — Student registers interest

> **Track:** Backend · **Lesson 7 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (picking one exact spot, and *replacing* — not duplicating — a live request)
> **🧩 Prerequisites:** [Lesson B5 — Admin enables/disables spaces](B5-admin-enable-disable-spaces.md).
> **🌿 CR branch:** `cr/b6-interest` (off `cr/b5-spaces`) · **📄 Source CR:** [backend guide → CR B6](../backend-development-guide.md#cr-b6--student-registers-interest) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

A backend feature that lets a **student pick one specific spot** in a lot and say "I want this one" — and that keeps at most one live request per student, no matter how many times they change their mind. Concretely, by the end of this hour you will have:

- `POST /api/interest` — a student picks exactly one available space in a lot. If they already have a `pending` request it's **updated in place** (not duplicated); otherwise a new one is created.
- `GET /api/interest/me` — a student sees their own current request as a single object (or `null` if they have none).
- `DELETE /api/interest/me` — a student withdraws their pending request.
- `GET /api/interest` — an admin sees *everyone's* requests, with an optional `?status=` filter.

**✅ Done when (your deliverable checklist):**
- [ ] `POST /api/interest` with an available `spaceId` returns `201` with a `pending` request the first time.
- [ ] The *same* student POSTing a **different** available spot returns `200` and replaces the request — still only one row for that student.
- [ ] POSTing an unknown `lotId` → `400` `"Unknown lot"`. Empty `spaceIds` → `400` `"Pick an available spot"`. Two or more `spaceIds` → `400` `"Only one spot can be requested"`. A taken/disabled spot → `409` `"The chosen spot is no longer available"`.
- [ ] A student who **already holds a spot** (a `fulfilled` request) POSTing again → `409` `"You already have a parking spot assigned"` — one active request per student, period.
- [ ] `GET /api/interest/me` (student) shows the one request object, or `null` after withdrawing.
- [ ] `DELETE /api/interest/me` returns `204` and a follow-up `GET /api/interest/me` is `null`.
- [ ] `GET /api/interest?status=pending` (admin) shows the request with the student's name and the picked spot's label attached.
- [ ] An admin hitting `POST /api/interest` gets `403`; a student hitting `GET /api/interest` gets `403`.
- [ ] Your work is committed on branch `cr/b6-interest` and pushed, PR base = `cr/b5-spaces`.

---

## 🤔 Why this lesson matters

Up to now, every endpoint you've built either *reads* data (B4) or is toggled by an *admin* (B5). This lesson is the first time a **student writes something into the database themselves** — and the first time that write has to target one exact row (`spaceIds: [<one id>]`), not a vague "preferred lot."

It's also the first time you'll write an **upsert**: instead of rejecting a second submission outright, `POST /api/interest` checks whether the caller already has a `pending` request and, if so, `UPDATE`s it to point at the new spot; only a caller with no pending request gets a fresh `INSERT`. That's the natural fix for "a student changes their mind and picks a different spot" — a flow a flat "reject the duplicate" rule would make clumsy (withdraw, then re-request, just to swap spots).

But the upsert only dedupes *pending* rows. The invariant we actually want is stronger — **one active request per student, period** — so a student who's *already been assigned a spot* (a `fulfilled` row) must not be able to open a second request while still holding it. So before the upsert, `create_interest` rejects with `409 "You already have a parking spot assigned"` when a `fulfilled` row exists (`webapp/App/views/interest.py:54-57`). Enforcing it here, at the source, is why later flows stay simple: when an admin unassigns a student, [B7](B7-admin-assigns-a-space.md) just flips that one `fulfilled` row back to `pending` — with no risk of colliding with a rival `pending` row, because there can never be one.

The `one_active_interest_per_user` partial unique index you created in B2 (`webapp/sql/migrations/001_init.sql:88-90`) is still the structural backstop: the database can never hold two `pending` rows for the same user, upsert code or not. One honest gap to know about: this endpoint's checks and its `INSERT`/`UPDATE` aren't wrapped in a specific handler for that index (`webapp/App/views/interest.py:62-80` catches a bare `Exception` only to roll back and re-raise), so a genuinely *simultaneous* double-submit would surface as a `500`, not a friendly `409` — the index still protects the data, just not the error message, in that narrow race window.

You'll also write your first endpoint with **four different access rules on four routes in the same file** — student, student, student, admin — which is exactly the shape most real APIs take: the same resource (`interest`), different views and permissions depending on who's asking.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **HTTP POST** | The method for *creating* something new on the server. | [MDN: HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST) |
| **Upsert (check-then-`UPDATE`-or-`INSERT`)** | Deciding at request time whether to update an existing row or insert a new one, so "at most one active row per user" never needs a rejection on a normal retry. | [PostgreSQL docs: UPDATE](https://www.postgresql.org/docs/current/sql-update.html) |
| **PostgreSQL array column + `ANY()`** | `space_ids INTEGER[]` stores the picked spot(s); `id = ANY(%s)` matches a row against every element of an array parameter. | [PostgreSQL docs: Arrays](https://www.postgresql.org/docs/current/arrays.html) |
| **Unique constraint / preventing duplicate rows** | A rule the *database* enforces so two rows can never both satisfy a condition — the structural backstop under the Python upsert logic. | [PostgreSQL docs: Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html) |
| **Request body JSON parsing in Flask** | Reading the JSON a client sent in a `POST` body as a Python dict. | [Flask docs: `Request.get_json`](https://flask.palletsprojects.com/en/stable/api/#flask.Request.get_json) |

---

## ✅ Before you start

**Prerequisites:** you've finished [Lesson B5 — Admin enables/disables spaces](B5-admin-enable-disable-spaces.md) — this lesson branches off B5's branch, so `interest`'s parent table dependencies (`users`, `lots`, `spaces`) and the `require_role` decorator already exist. You'll also lean on the `interest` table, its `space_ids INTEGER[]` column, and the `one_active_interest_per_user` partial unique index, all created back in B2 (`webapp/sql/migrations/001_init.sql:77-90`).

**Time budget for the hour:** branch (5 min) → write `views/interest.py` (30) → register the blueprint (5) → local testing (15) → commit (5).

**Open your terminal, activate the virtual environment, and make your branch** — off `cr/b5-spaces`, not `main` (this is a stacked CR):

```bash
git checkout cr/b5-spaces
git checkout -b cr/b6-interest
```

---

## 🛠 Build it, step by step

### Step 1 — Write the interest endpoints (~30 min)

Create `webapp/App/views/interest.py`:

```python
# webapp/App/views/interest.py
from flask import Blueprint, request, jsonify, g

from ..db import query, query_one, get_db
from ..auth import require_role
from .. import serialize

bp = Blueprint("interest", __name__)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _interest(interest_id):
    row = query_one(serialize.INTEREST_SELECT + " WHERE i.id = %s", (interest_id,))
    return serialize.interest(row) if row else None


def _coerce_ids(raw):
    """Turn an incoming spaceIds value into a list of ints, dropping non-numbers."""
    if not isinstance(raw, list):
        return []
    ids = []
    for value in raw:
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            ids.append(value)
        elif isinstance(value, str) and value.strip().lstrip("-").isdigit():
            ids.append(int(value))
    return ids


@bp.post("/api/interest")
@require_role("student")
def create_interest():
    body = request.get_json(silent=True) or {}
    lot_id = body.get("lotId")
    if not isinstance(lot_id, int) or query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("bad_request", "Unknown lot", 400)

    requested_ids = _coerce_ids(body.get("spaceIds"))
    if len(requested_ids) == 0:
        return _err("bad_request", "Pick an available spot", 400)
    if len(requested_ids) > 1:
        return _err("bad_request", "Only one spot can be requested", 400)
    available = query(
        "SELECT id FROM spaces WHERE lot_id = %s AND status = 'available' AND id = ANY(%s)",
        (lot_id, requested_ids))
    if len(available) != len(requested_ids):
        return _err("conflict", "The chosen spot is no longer available", 409)

    # One active request per student: an assigned student (fulfilled request)
    # cannot open a second request while still holding a spot.
    if query_one("SELECT id FROM interest WHERE user_id = %s AND status = 'fulfilled'", (g.user["id"],)):
        return _err("conflict", "You already have a parking spot assigned", 409)

    existing = query_one(
        "SELECT id FROM interest WHERE user_id = %s AND status = 'pending'", (g.user["id"],))
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            if existing:
                cursor.execute(
                    "UPDATE interest SET lot_id = %s, space_ids = %s, created_at = now() "
                    "WHERE id = %s RETURNING id",
                    (lot_id, requested_ids, existing["id"]))
                status_code = 200
            else:
                cursor.execute(
                    "INSERT INTO interest (user_id, lot_id, space_ids, status) "
                    "VALUES (%s, %s, %s, 'pending') RETURNING id",
                    (g.user["id"], lot_id, requested_ids))
                status_code = 201
            interest_id = cursor.fetchone()["id"]
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return jsonify({"data": _interest(interest_id)}), status_code


@bp.get("/api/interest/me")
@require_role("student")
def my_interest():
    row = query_one(
        serialize.INTEREST_SELECT + " WHERE i.user_id = %s AND i.status <> 'cancelled' "
        "ORDER BY i.id DESC LIMIT 1", (g.user["id"],))
    return jsonify({"data": serialize.interest(row) if row else None})


@bp.delete("/api/interest/me")
@require_role("student")
def withdraw_interest():
    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE interest SET status = 'cancelled' "
            "WHERE user_id = %s AND status = 'pending'", (g.user["id"],))
    connection.commit()
    return "", 204


@bp.get("/api/interest")
@require_role("admin")
def list_interest():
    status = request.args.get("status")
    sql = serialize.INTEREST_SELECT
    params = ()
    if status:
        sql += " WHERE i.status = %s"
        params = (status,)
    sql += " ORDER BY i.created_at ASC, i.id ASC"
    rows = query(sql, params)
    return jsonify({"data": [serialize.interest(row) for row in rows]})
```

**Explanation, piece by piece:**
- `serialize.INTEREST_SELECT` (`webapp/App/serialize.py:20-27`) — the one query every route below reuses: `interest` joined to `users` (`user_name`), left-joined to `lots` (`lot_name`), plus `space_labels` via `ARRAY(SELECT sp.label FROM spaces sp WHERE sp.id = ANY(i.space_ids))`. `serialize.interest(row)` (`serialize.py:71-84`) turns that row into `{id, user_id, user_name, lot_id, lot_name, space_ids, space_labels, status, created_at}` — the same shape from every route, so nothing here invents its own response format.
- `_coerce_ids(raw)` (`interest.py:20-32`) — defends against a malformed body: anything that isn't a list becomes `[]`; non-numeric entries (and `bool`, which is a `int` subclass in Python) are dropped rather than silently coerced.
- **Four checks in `create_interest`, in order:**
  1. `lot_id` must be an `int` naming a real row in `lots` (`interest.py:39-41`), else `400 "Unknown lot"`.
  2. `requested_ids` must have exactly one element (`interest.py:44-47`) — zero → `400 "Pick an available spot"`; more than one → `400 "Only one spot can be requested"`. The PoC's `space_ids` column is an array "for forward-compat," but today the API only ever accepts one.
  3. That one id must resolve to a `status = 'available'` space **in that lot** (`interest.py:48-52`) — `id = ANY(%s)` matches the array parameter against the single-element list; a mismatched count means the spot is taken, disabled, or in the wrong lot → `409 "The chosen spot is no longer available"`.
  4. The caller must not **already hold a spot** (`interest.py:54-57`) — if a `fulfilled` row exists for this user, `409 "You already have a parking spot assigned"`. This is the "one active request per student, period" invariant: an assigned student can't queue for a second spot without first being unassigned.
- **The upsert** (`interest.py:59-81`) — look up the caller's `pending` row first. If one exists, `UPDATE` it (new `lot_id`, new `space_ids`, refreshed `created_at`) and return `200`; otherwise `INSERT` a new `pending` row and return `201`. Because both branches run inside the same `try`/`with connection.cursor()`/`commit()`, and any exception triggers `rollback()` before re-raising, the caller never ends up with a half-written row. → [PostgreSQL docs: UPDATE](https://www.postgresql.org/docs/current/sql-update.html).
- `my_interest()` (`interest.py:84-90`) — filtered to `i.user_id = g.user["id"]` and `i.status <> 'cancelled'`, `ORDER BY i.id DESC LIMIT 1`, so it's the caller's latest live request as **one object**, or `null` — never a list.
- `withdraw_interest()` (`interest.py:93-102`) — `UPDATE ... WHERE user_id = %s AND status = 'pending'`. If the caller has no pending row, the `UPDATE` matches zero rows and nothing happens; either way the response is `204`, so there's no need to check the row count first.
- `list_interest()` (`interest.py:105-116`) — the admin's view: no `user_id` filter (admins see everyone), an optional `?status=` query filter, `ORDER BY i.created_at ASC, i.id ASC`. Because it reuses `INTEREST_SELECT`, the admin sees `user_name` and `lot_name` for free — no separate `JOIN` to hand-roll.

### Step 2 — Register the blueprint (~5 min)

Open `webapp/App/__init__.py` and register it alongside the other blueprints:

```python
    from .views import interest
    app.register_blueprint(interest.bp)
```

**Why this line matters:** a Blueprint is just a bundle of routes until the app registers it — without this line, Flask has no idea `/api/interest` exists, no matter how correct `interest.py` is. (Register only `interest` here — later lessons add their own blueprint one at a time; the shipped app registers all of them at once, but that's a PoC-local shortcut you shouldn't backport into the stacked CRs.)

---

## 🧪 Prove it works — testing guide

**Setup:** server running (`flask run` or however B1 set it up); `$S` = a student's login token (use STU003 / Andrew — he's the one seeded student with *no* interest row, so his first POST is a clean `201`; Bob and Olivia already have seeded `pending` rows, and Alice a `fulfilled` one), `$A` = an admin's login token. Seed data (`webapp/sql/seed.sql:32-41`) makes Lot 1 (id `1`) spaces `A1`..`A8` = space ids `1`..`8`: `A1`-`A3`,`A5`-`A7` available, `A4` (id `4`) disabled, `A8` (id `8`) assigned to Alice.

**Steps:**
```bash
# 1. Pick A1 (available) — first request, expect 201.
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1,"spaceIds":[1]}'

# 2. Change your mind, pick A2 instead — expect 200, still one row.
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1,"spaceIds":[2]}'

# 3. Try the disabled spot A4 — expect 409.
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1,"spaceIds":[4]}'

# 4. Empty spaceIds — expect 400 "Pick an available spot".
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1,"spaceIds":[]}'

# 5. Two spaceIds — expect 400 "Only one spot can be requested".
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1,"spaceIds":[2,3]}'

# 6. Your current request — expect the one object, pointing at A2.
curl -s http://localhost:8000/api/interest/me -H "Authorization: Bearer $S"

# 7. Withdraw — expect 204.
curl -i -X DELETE http://localhost:8000/api/interest/me -H "Authorization: Bearer $S"

# 8. Confirm it's gone — expect {"data":null}.
curl -s http://localhost:8000/api/interest/me -H "Authorization: Bearer $S"

# 9. Re-pick A1 so there's something for the admin to see — expect 201.
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"lotId":1,"spaceIds":[1]}'

# 10. Admin's view — expect Andrew's new row (user_name "Andrew", lot_name "Lot 1",
#     space_labels ["A1"]) plus the seed's Bob and Olivia rows on Lot 4.
curl -s "http://localhost:8000/api/interest?status=pending" -H "Authorization: Bearer $A"

# 11. One-active-request: Alice already holds Lot 1 · A8 (a fulfilled row), so any
#     new request from her is rejected — expect 409 "You already have a parking spot assigned".
ALICE=$(curl -s -X POST http://localhost:8000/api/auth/student \
  -H 'Content-Type: application/json' -d '{"code":"STU001"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')
curl -i -X POST http://localhost:8000/api/interest \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' -d '{"lotId":2,"spaceIds":[9]}'
```

**What you should see:**
- Step 1 → `201` with a `pending` request for `A1`.
- Step 2 → `200`; the same request now points at `A2` (no second row).
- Step 3 → `409` `"The chosen spot is no longer available"`.
- Step 4 → `400` `"Pick an available spot"`. Step 5 → `400` `"Only one spot can be requested"`.
- Step 6 → the one request object, `space_ids: [2]`, `space_labels: ["A2"]`.
- Step 7 → `204`. Step 8 → `{"data": null}`.
- Step 9 → `201` (the withdrawn row was `cancelled`, not `pending`, so this is a fresh insert).
- Step 10 → Andrew's request, with `user_name`, `lot_name`, and `space_labels` attached — plus the two the seed already had pending on Lot 4 (Bob and Olivia).
- Step 11 → `409` `"You already have a parking spot assigned"` — Alice's `fulfilled` row blocks a second request. (Space id `9` is Lot 4's first spot; the exact spot doesn't matter, the check fires before availability even gets a chance to matter here since the fulfilled guard sits right after it.)
- An admin hitting `POST /api/interest` → `403`; a student hitting `GET /api/interest` → `403`. (Try both to confirm the role guard on each route.)

**☁️ Cloud check (optional):** after `./release.sh backend`, POST an interest to `http://<ElasticIp>/api/interest` with a server student token, then read it back with `/api/interest/me`. This is the backend half of the full E2E flow in **Part 1E** of the backend guide — running it in the cloud means UI CR **U5** can be tested against the live server too.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B6: student picks a spot (upsert) + withdraw + admin list"
git push -u origin cr/b6-interest
```

Then open a Pull Request on GitHub with **base = `cr/b5-spaces`** (this CR stacks on B5, not `main`). Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Re-submitting a different spot creates a second row instead of replacing** — check the "existing pending request" lookup (`interest.py:59-60`) filters on `status = 'pending'`, and that the `UPDATE` branch targets `existing["id"]`, not a fresh insert.
- **An already-assigned student can still open a new request** — the `fulfilled`-row guard (`interest.py:54-57`) must run *before* the pending-row upsert; without it, unassigning that student later can leave two `pending` rows and trip the `one_active_interest_per_user` index with a `500`.
- **Picking a disabled/assigned spot returns `201` instead of `409`** — confirm the availability query filters `status = 'available'` **and** `lot_id = %s` (`interest.py:48-50`), and that you're comparing `len(available) != len(requested_ids)`, not just checking `available` is truthy.
- **Empty or two-element `spaceIds` slips through** — the two length checks (`interest.py:44-47`) must run *before* the availability query; otherwise a bad list can reach `ANY(%s)` and behave unpredictably.
- **`GET /api/interest/me` returns a list instead of one object/`null`** — you likely reused a list comprehension from `list_interest`; it should be `serialize.interest(row) if row else None` on a single `query_one` result (`interest.py:87-90`).
- **`DELETE /api/interest/me` 404s or 500s when nothing is pending** — there's nothing to guard: the `UPDATE`'s `WHERE` clause matches zero rows harmlessly, so always return `204` (`interest.py:93-102`).
- **Every request returns `403`** — your `$S`/`$A` token may have expired (B3's tokens expire) or you copied the token without the `Bearer ` prefix. Re-login and retry.

---

## 📝 Recap

- You built your first **student-writable** endpoint — `POST /api/interest` — that targets one exact spot, plus the withdraw and two role-scoped read endpoints that go with it.
- You learned the **upsert** pattern: check for an existing `pending` row, then branch between `UPDATE` and `INSERT`, so "at most one active request" never needs to reject a normal retry — with the B2 partial unique index as the structural backstop underneath.
- You enforced **one active request per student, period**: a `fulfilled`-row guard rejects a second request from an already-assigned student at the source, which is what keeps the unassign flow in B7 a simple one-row `pending` flip with no risk of a duplicate-row collision.
- You used a PostgreSQL array column (`space_ids INTEGER[]`) and `ANY()` to match a single picked spot against a set-shaped column.
- You saw the same resource (`interest`) exposed through four routes with four different access rules — the shape most real REST APIs take.

---

## 📚 References

- [MDN: HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST) — the method for creating resources.
- [PostgreSQL docs: UPDATE](https://www.postgresql.org/docs/current/sql-update.html) — the other half of an upsert.
- [PostgreSQL docs: Arrays](https://www.postgresql.org/docs/current/arrays.html) — `INTEGER[]` columns and `ANY()`.
- [PostgreSQL docs: Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html) — how the database prevents duplicate rows even under a race.
- [Flask docs: `Request.get_json`](https://flask.palletsprojects.com/en/stable/api/#flask.Request.get_json) — parsing a JSON request body.
- Source of truth for this lesson: [backend guide → CR B6](../backend-development-guide.md#cr-b6--student-registers-interest).

---

## ➡️ Next lesson

**[Lesson B7 — Admin assigns a space](B7-admin-assigns-a-space.md).** You'll close the loop: an admin turns a `pending` interest into an actual space assignment. → [source CR](../backend-development-guide.md#cr-b7--admin-assigns-a-space).
