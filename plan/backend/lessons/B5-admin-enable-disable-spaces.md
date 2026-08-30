# Lesson B5 — Admin enables/disables spaces

> **Track:** Backend · **Lesson 6 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first endpoint that *changes* data and can be *refused* — two rules stacked on one route)
> **🧩 Prerequisites:** you've finished [Lesson B4 — Read lots & spaces](B4-read-lots-and-spaces.md) — the server runs, you can log in as both a student and an admin, and `GET /api/lots/:id/spaces` returns real rows.
> **🌿 CR branch:** `cr/b5-spaces` (off `cr/b4-lots`) · **📄 Source CR:** [backend guide → CR B5](../backend-development-guide.md#cr-b5--admin-enablesdisables-spaces) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

The backend's first **write** endpoints — and its first endpoint that an admin can use to change something for everyone. Concretely, by the end of this hour you will have:

- `PATCH /api/spaces/<id>` — an admin flips one space between `available` and `disabled`.
- `PATCH /api/spaces` — an admin flips **many** spaces at once, given a list of ids and a target status.
- A business rule enforced on both routes: a space that is currently `assigned` (someone parks there) **cannot** be disabled. The single route returns `409` for that one space; the bulk route checks *every* target first and rejects the **whole call** with `409` if even one of them is assigned — there's no partial "some updated, some skipped" outcome.
- Both routes locked to admins only with `@require_role("admin")` — a student token gets `403`.
- Both reuse `serialize.SPACE_SELECT` / `serialize.space` from [B4](B4-read-lots-and-spaces.md) — a `PATCH` response looks exactly like every other space you've already read.

**✅ Done when (your deliverable checklist):**
- [ ] Bulk `PATCH /api/spaces` with `{"ids":[2,3],"status":"disabled"}` as admin (Lot 1's A2/A3, both `available`) → `200` with `{"data":[<2 serialized spaces>]}`, each `status: "disabled"`.
- [ ] Re-reading `GET /api/lots/1/spaces` shows A2 and A3 as `disabled`.
- [ ] Bulk `PATCH /api/spaces` with `{"ids":[1,8],"status":"disabled"}` (id 8 = A8, seeded `assigned`) → `409`, and space 1 (A1) is untouched — the whole call was rejected, not just A8.
- [ ] Single `PATCH /api/spaces/2` with `{"status":"available"}` as admin → `200`, space 2 back to `available`.
- [ ] The same request with a **student** token → `403` `{"error":{"code":"forbidden",...}}`.
- [ ] `{"status":"banana"}` → `400` (not a valid status).
- [ ] Your work is committed on branch `cr/b5-spaces` and pushed, PR base = `cr/b4-lots`.

---

## 🤔 Why this lesson matters

Every route you've built so far only **reads**: health checks, logins, lots, spaces. Nothing you've written yet can change what's stored in the database. This lesson is the turning point on the *write* side — the first `PATCH`, the first place the backend has to say "no" to a request that looks fine on the surface but breaks a rule about the *data itself*.

Look closely at the single-space route and you'll see it check **two separate things** before it touches the database: *"is this person allowed to do this at all?"* (the `@require_role("admin")` decorator — a question about the **user**) and *"does this specific change make sense right now?"* (the `assigned` check — a question about the **data**). Keeping those two checks separate, in that order, is a pattern every write endpoint in this backend follows: authorize first, validate the business rule second.

The bulk route adds a second idea worth sitting with, and it cuts the *other* way from what you might expect: when one request tries to change many things, this backend does **not** apply the change to whatever it can and report the rest as skipped. It inspects every target first, and if even one of them is `assigned`, the entire call is rejected — no ids change. An admin who bulk-disables a row of spots either gets exactly what they asked for, or nothing at all; there's no response to parse for "which ones actually happened."

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **HTTP `PATCH`** | The HTTP method that means "apply a partial change to this resource" — unlike `PUT`, you send only the fields you're changing. | [MDN: PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) |
| **REST update semantics** | The spec that formally defines what a `PATCH` request body means and how a server should apply it. | [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789) |
| **Read-after-write via a shared `SELECT`** | `UPDATE` changes the row; a follow-up query through `serialize.SPACE_SELECT` (from [B4](B4-read-lots-and-spaces.md)) re-fetches it, so the `PATCH` response is built by the exact same shape-function every other space-returning endpoint uses. | [Postgres: `UPDATE`](https://www.postgresql.org/docs/current/sql-update.html) |
| **Role-based authorization** | Deciding what a request is allowed to do based on the *role* of the logged-in user (`admin` vs `student`), not just whether they're logged in. | [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) |
| **Idempotency** | An operation is idempotent if doing it twice has the same effect as doing it once. Setting a space to `disabled` twice in a row leaves it `disabled` either way — no harm in retrying. | [MDN Glossary: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → single-space `PATCH` route (15) → bulk `PATCH` route (15) → register the blueprint (5) → test & commit (20).

**Open your terminal, activate the virtual environment, and make your branch.** B5 stacks on top of B4 — it needs the lots/spaces you can already read and the `@require_role` guard from B3:

```bash
git checkout cr/b4-lots
git checkout -b cr/b5-spaces
```

**What this does & why:** branching off `cr/b4-lots` (not `main`) means this branch already has everything B0–B4 built. You're only adding the two new routes below. This is the same **stacked-CR** pattern you used going into B4. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — The single-space route (~15 min)

Create `webapp/App/views/spaces.py`:

```python
# webapp/App/views/spaces.py
from flask import Blueprint, request, jsonify

from ..db import query, query_one, get_db
from ..auth import require_role
from .. import serialize

bp = Blueprint("spaces", __name__)
ALLOWED = {"available", "disabled"}   # admins toggle these; 'assigned' is set by the assign flow


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _space(space_id):
    row = query_one(serialize.SPACE_SELECT + " WHERE s.id = %s", (space_id,))
    return serialize.space(row) if row else None


@bp.patch("/api/spaces/<int:space_id>")
@require_role("admin")
def update_space(space_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in ALLOWED:
        return _err("bad_request", "status must be 'available' or 'disabled'", 400)

    space = query_one("SELECT id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if space["status"] == "assigned":
        return _err("conflict", "Space is assigned; unassign it first", 409)

    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute("UPDATE spaces SET status = %s WHERE id = %s", (status, space_id))
    connection.commit()
    return jsonify({"data": _space(space_id)})
```
(`webapp/App/views/spaces.py:1-39`)

**Explanation, piece by piece:**
- `@bp.patch("/api/spaces/<int:space_id>")` then `@require_role("admin")` **underneath** (`spaces.py:21-22`) — decorators run bottom-up, so `require_role("admin")` checks the token *before* Flask ever calls `update_space`. A missing token gets `401`; a valid **student** token gets `403`. Only an admin token reaches the function body. → [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- `if status not in ALLOWED: return ... 400` (`spaces.py:26-27`) — this is **input validation**, checked first, before any database work. `ALLOWED` deliberately excludes `"assigned"` — an admin can only ever request `available` or `disabled` through this route; `assigned` is a status the assign flow sets automatically when a space is handed out, never something an admin types in directly.
- `space = query_one(...)` then `if space is None: ... 404` (`spaces.py:29-31`) — the same "does it exist?" check you saw in B4's `lot_spaces`, now guarding a write instead of a read. This is a plain `id, status` lookup, not the full `SPACE_SELECT` — you only need `status` to make the 409 decision.
- `if space["status"] == "assigned": ... 409` (`spaces.py:32-33`) — the business rule. This is *not* an authorization check (the admin is definitely allowed to PATCH) and *not* a validation check (`"disabled"` is a perfectly valid status) — it's a rule about the **current state of this particular row**. `409 Conflict` is the right status code for "your request is valid, but it conflicts with the resource's current state." → [MDN: PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH).
- `connection.cursor()` + a raw `UPDATE` + one `connection.commit()` (`spaces.py:35-38`) — a plain write, no `RETURNING`; the row's *new* shape is fetched separately, right after.
- `_space(space_id)` (`spaces.py:16-18`) re-queries through `serialize.SPACE_SELECT` and hands the row to `serialize.space` — the same shared shape-function [B4](B4-read-lots-and-spaces.md) introduced. That's why the response is snake_case (`assigned_user_id`, `assigned_user_name`, `assigned_student_id`, and position as `x/y/w/h/rotation`), identical to what `GET /api/lots/:id/spaces` already returns for this space — a `PATCH` response never invents its own shape.

> **Why is this route idempotent?** Sending `{"status":"disabled"}` to an already-`disabled` space just runs the same `UPDATE`, changes nothing, and returns the same `200`. Retrying a `PATCH` that already succeeded (e.g. because a response got lost on a flaky connection) is safe — it doesn't create a duplicate or double-apply anything. → [MDN Glossary: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent).

### Step 2 — The bulk route (~15 min)

Add this to the same file, `webapp/App/views/spaces.py`:

```python
@bp.patch("/api/spaces")
@require_role("admin")
def bulk_update_spaces():
    body = request.get_json(silent=True) or {}
    ids, status = body.get("ids"), body.get("status")
    if not isinstance(ids, list) or status not in ALLOWED:
        return _err("bad_request", "ids (array) and status (available|disabled) required", 400)

    targets = query("SELECT id, status FROM spaces WHERE id = ANY(%s)", (ids,))
    if any(row["status"] == "assigned" for row in targets):
        return _err("conflict", "cannot change an assigned space", 409)

    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute("UPDATE spaces SET status = %s WHERE id = ANY(%s)", (status, ids))
    connection.commit()

    rows = query(serialize.SPACE_SELECT + " WHERE s.id = ANY(%s) ORDER BY s.id", (ids,))
    return jsonify({"data": [serialize.space(row) for row in rows]})
```
(`webapp/App/views/spaces.py:42-60`)

**Explanation, piece by piece:**
- `if not isinstance(ids, list) or status not in ALLOWED: ... 400` (`spaces.py:47-48`) — `ids` must actually be a list (not a single number, not a string) and `status` must be one of the two allowed values. Same "validate before touching the database" order as Step 1.
- `targets = query("SELECT id, status FROM spaces WHERE id = ANY(%s)", (ids,))` (`spaces.py:50`) — one query fetches every target row's current status, up front, before anything is written.
- `if any(row["status"] == "assigned" for row in targets): ... 409` (`spaces.py:51-52`) — the whole-call rule: if **any** target is currently `assigned`, the entire request is rejected right here. Nothing has been written yet, so nothing needs to be rolled back — there's no partial state to reason about. This is deliberately different from a route that applies what it can and reports the rest as skipped; here it's all-or-nothing.
- `cursor.execute("UPDATE spaces SET status = %s WHERE id = ANY(%s)", ...)` (`spaces.py:55-56`) — a single `UPDATE` covers every id in one round trip, followed by one `connection.commit()` — not a loop with a query per id.
- `rows = query(serialize.SPACE_SELECT + " WHERE s.id = ANY(%s) ORDER BY s.id", (ids,))` then `[serialize.space(row) for row in rows]` (`spaces.py:59-60`) — the same shared shape-function as the single-space route, run over every updated id, ordered by id for a stable response.
- The response — `{"data": [<serialized space>, ...]}` — is a plain array of the now-updated spaces, the same shape you'd get reading them back from `GET /api/lots/:id/spaces`. There is no `updated`/`skipped` split to parse.

### Step 3 — Register the blueprint (~5 min)

Open `webapp/App/__init__.py` and add these two lines next to where you registered `lots` in B4:

```python
    from .views import spaces
    app.register_blueprint(spaces.bp)
```

**Why this step exists:** exactly as in every earlier lesson — defining a `Blueprint` doesn't wire it into the running app by itself. Skip this line and both `PATCH /api/spaces` routes will 404 no matter how correct the code above is. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

---

## 🧪 Prove it works — testing guide

1. **Setup:** the server running (`flask run --port 8000`). Get an **admin** token and a **student** token from B3's login endpoints and save both:

   **macOS / Linux**

   ```bash
   export A=<paste-an-admin-token>
   export S=<paste-a-student-token>
   ```

   **Windows (PowerShell)**

   ```powershell
   $env:A = "<paste-an-admin-token>"
   $env:S = "<paste-a-student-token>"
   ```

2. **Steps** (ids below are the seeded Lot 1 spaces: A1=1, A2=2, A3=3, A4=4 `disabled`, ... A8=8 `assigned` to Alice — see `webapp/sql/seed.sql`):

   **macOS / Linux**

   ```bash
   # bulk-disable two AVAILABLE spaces (A2, A3) as admin
   curl -i -X PATCH http://localhost:8000/api/spaces \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"ids":[2,3],"status":"disabled"}'

   # confirm it stuck
   curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"

   # bulk-disable that INCLUDES the assigned A8 (id 8) — whole call must be rejected
   curl -i -X PATCH http://localhost:8000/api/spaces \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"ids":[1,8],"status":"disabled"}'

   # confirm A1 (id 1) did NOT change — the rejected call touched nothing
   curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"

   # single re-enable
   curl -i -X PATCH http://localhost:8000/api/spaces/2 \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"status":"available"}'

   # a student must NOT be allowed
   curl -i -X PATCH http://localhost:8000/api/spaces/3 \
     -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"status":"available"}'

   # an invalid status must be rejected
   curl -i -X PATCH http://localhost:8000/api/spaces/2 \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"status":"banana"}'
   ```

   **Windows (PowerShell)**

   ```powershell
   # bulk-disable two AVAILABLE spaces (A2, A3) as admin
   Invoke-RestMethod -Method Patch http://localhost:8000/api/spaces `
     -Headers @{Authorization="Bearer $env:A"} -ContentType application/json `
     -Body '{"ids":[2,3],"status":"disabled"}'

   # confirm it stuck
   Invoke-RestMethod http://localhost:8000/api/lots/1/spaces -Headers @{Authorization="Bearer $env:A"}

   # bulk-disable that INCLUDES the assigned A8 (id 8) — whole call must be rejected
   Invoke-RestMethod -Method Patch http://localhost:8000/api/spaces `
     -Headers @{Authorization="Bearer $env:A"} -ContentType application/json `
     -Body '{"ids":[1,8],"status":"disabled"}'

   # confirm A1 (id 1) did NOT change — the rejected call touched nothing
   Invoke-RestMethod http://localhost:8000/api/lots/1/spaces -Headers @{Authorization="Bearer $env:A"}

   # single re-enable
   Invoke-RestMethod -Method Patch http://localhost:8000/api/spaces/2 `
     -Headers @{Authorization="Bearer $env:A"} -ContentType application/json -Body '{"status":"available"}'

   # a student must NOT be allowed
   Invoke-RestMethod -Method Patch http://localhost:8000/api/spaces/3 `
     -Headers @{Authorization="Bearer $env:S"} -ContentType application/json -Body '{"status":"available"}'

   # an invalid status must be rejected
   Invoke-RestMethod -Method Patch http://localhost:8000/api/spaces/2 `
     -Headers @{Authorization="Bearer $env:A"} -ContentType application/json -Body '{"status":"banana"}'
   ```
3. **Expected:**
   - Bulk-disable `[2,3]` → `200` with `{"data":[<A2>,<A3>]}`, both `status: "disabled"`; re-reading the lot confirms it.
   - Bulk-disable `[1,8]` (A8 assigned) → `409`; re-reading the lot shows A1 still `available` — nothing in the request was applied.
   - Single re-enable of space 2 → `200`, back to `available`.
   - Student token → `403` `{"error":{"code":"forbidden",...}}`.
   - `{"status":"banana"}` → `400`.

**☁️ Cloud check (optional):** after `./release.sh backend`, repeat the bulk-disable against `http://<ElasticIp>` with a server admin token, then re-read the lot to confirm it persisted in RDS.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B5: admin enable/disable single + bulk spaces"
git push -u origin cr/b5-spaces
```

Then open a Pull Request on GitHub with **base = `cr/b4-lots`** — not `main` — since this CR stacks on top of it. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`403` on a request you expected to succeed** — check *whose* token you sent. Both routes are admin-only by design; a student token getting `403` here is correct behavior, not a bug.
- **`409` on a space you expected to disable** — that space's status is already `assigned`. That's the business rule working as intended; it can't be disabled until it's unassigned (the assign flow handles that).
- **`409` on a bulk call where most ids looked fine** — check whether *any* id in the list is currently `assigned` (e.g. id 8 / A8 in the seed data). The bulk route rejects the entire call if even one target is assigned, so none of the ids changed — remove the offending id (or unassign it first) and resend.
- **Both `PATCH` routes 404** — you likely skipped Step 3. Confirm `app.register_blueprint(spaces.bp)` is actually in `webapp/App/__init__.py`.
- **`curl` seems to "hang" or do nothing on the PATCH commands** — you forgot `-X PATCH`; without it `curl` defaults to `GET`, which this route doesn't support. On Windows, the equivalent mistake is forgetting `-Method Patch` on `Invoke-RestMethod` (it defaults to `GET` too).

---

## 📝 Recap — what you built and learned

- You wrote the backend's **first write endpoints** — `PATCH` routes that actually change rows in PostgreSQL, not just read them.
- You saw two different kinds of "no" stacked on one route: **authorization** (`@require_role("admin")` — is this user allowed at all?) checked first, then a **business rule** (`assigned` can't be disabled — does this specific change make sense right now?) checked second.
- You built a **bulk endpoint** that checks every target *before* writing anything, and rejects the whole call with `409` if even one is assigned — an all-or-nothing outcome, not a per-id `updated`/`skipped` report.
- You reused `serialize.SPACE_SELECT` / `serialize.space` from B4 for both routes, so a `PATCH` response is built by the exact same shape-function as `GET /api/lots/:id/spaces` — no route invents its own dict.

---

## 📚 References

- [MDN: HTTP `PATCH` method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) — partial updates.
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789) — the formal spec `PATCH` follows.
- [Postgres: `UPDATE`](https://www.postgresql.org/docs/current/sql-update.html) — changing rows.
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — role-based access control.
- [MDN Glossary: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent) — why retrying this route safely is fine.
- [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) — registering the routes you wrote.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [backend guide → CR B5](../backend-development-guide.md#cr-b5--admin-enablesdisables-spaces).

---

## ➡️ Next lesson

**[Lesson B6 — Student registers interest](B6-student-registers-interest.md).** You'll build the first endpoint where a **student** writes data — registering interest in a parking spot — and add a duplicate-request guard so the same student can't create two pending requests at once. → [source CR](../backend-development-guide.md#cr-b6--student-registers-interest).
