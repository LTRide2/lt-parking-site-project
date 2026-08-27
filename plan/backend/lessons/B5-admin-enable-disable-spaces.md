# Lesson B5 — Admin enables/disables spaces

> **Track:** Backend · **Lesson 6 of 8**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first endpoint that *changes* data and can be *refused* — two rules stacked on one route)
> **🧩 Prerequisites:** you've finished [Lesson B4 — Read lots & spaces](B4-read-lots-and-spaces.md) — the server runs, you can log in as both a student and an admin, and `GET /api/lots/:id/spaces` returns real rows.
> **🌿 CR branch:** `cr/b5-spaces` (off `cr/b4-lots`) · **📄 Source CR:** [backend guide → CR B5](../backend-development-guide.md#cr-b5--admin-enablesdisables-spaces) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

The backend's first **write** endpoints — and its first endpoint that an admin can use to change something for everyone. Concretely, by the end of this hour you will have:

- `PATCH /api/spaces/<id>` — an admin flips one space between `available` and `disabled`.
- `PATCH /api/spaces` — an admin flips **many** spaces at once, given a list of ids and a target status.
- A business rule enforced on both routes: a space that is currently `assigned` (someone parks there) **cannot** be disabled — the single route returns `409`, the bulk route reports it in `skipped` instead of stopping everything else.
- Both routes locked to admins only with `@require_role("admin")` — a student token gets `403`.

**✅ Done when (your deliverable checklist):**
- [ ] Bulk `PATCH /api/spaces` with `{"ids":[1,2,3],"status":"disabled"}` as admin → `200` with `updated:[1,2,3]`, `skipped:[]`.
- [ ] Re-reading `GET /api/lots/1/spaces` shows spaces 1–3 as `disabled`.
- [ ] Single `PATCH /api/spaces/1` with `{"status":"available"}` as admin → `200`, space 1 back to `available`.
- [ ] The same request with a **student** token → `403` `{"error":{"code":"forbidden",...}}`.
- [ ] `{"status":"banana"}` → `400` (not a valid status).
- [ ] Your work is committed on branch `cr/b5-spaces` and pushed, PR base = `cr/b4-lots`.

---

## 🤔 Why this lesson matters

Every route you've built so far only **reads**: health checks, logins, lots, spaces. Nothing you've written yet can change what's stored in the database. This lesson is the turning point on the *write* side — the first `PATCH`, the first place the backend has to say "no" to a request that looks fine on the surface but breaks a rule about the *data itself*.

Look closely at the single-space route and you'll see it check **two separate things** before it touches the database: *"is this person allowed to do this at all?"* (the `@require_role("admin")` decorator — a question about the **user**) and *"does this specific change make sense right now?"* (the `assigned` check — a question about the **data**). Keeping those two checks separate, in that order, is a pattern every write endpoint in this backend follows: authorize first, validate the business rule second.

The bulk route adds a second idea worth sitting with: when one request tries to change *many* things, "some succeeded, some didn't" is often the right answer — not "reject everything because one id was bad." Reporting `updated` and `skipped` separately, instead of crashing on the first problem, is what makes a bulk endpoint actually usable by an admin managing a whole lot of spaces at once.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **HTTP `PATCH`** | The HTTP method that means "apply a partial change to this resource" — unlike `PUT`, you send only the fields you're changing. | [MDN: PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) |
| **REST update semantics** | The spec that formally defines what a `PATCH` request body means and how a server should apply it. | [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789) |
| **SQL `UPDATE ... RETURNING`** | `UPDATE` changes existing rows; `RETURNING` hands back the changed row in the same trip, so you don't need a second `SELECT` to confirm what happened. | [Postgres: `UPDATE`](https://www.postgresql.org/docs/current/sql-update.html) |
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

from ..db import query_one, execute, get_db
from ..auth import require_role

bp = Blueprint("spaces", __name__)
ALLOWED = {"available", "disabled"}   # admins toggle these; 'assigned' is set by B7


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


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

    row = execute(
        "UPDATE spaces SET status = %s WHERE id = %s "
        "RETURNING id, label, status, assigned_user_id", (status, space_id))
    return jsonify({"data": {
        "id": row["id"], "label": row["label"], "status": row["status"],
        "assignedUserId": row["assigned_user_id"],
    }})
```

**Explanation, piece by piece:**
- `@bp.patch("/api/spaces/<int:space_id>")` then `@require_role("admin")` **underneath** — decorators run bottom-up, so `require_role("admin")` checks the token *before* Flask ever calls `update_space`. A missing token gets `401`; a valid **student** token gets `403`. Only an admin token reaches the function body. → [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- `if status not in ALLOWED: return ... 400` — this is **input validation**, checked first, before any database work. `ALLOWED` deliberately excludes `"assigned"` — an admin can only ever request `available` or `disabled` through this route; `assigned` is a status B7 sets automatically when a space is handed out, never something an admin types in directly.
- `space = query_one(...)` then `if space is None: ... 404` — the same "does it exist?" check you saw in B4's `lot_spaces`, now guarding a write instead of a read.
- `if space["status"] == "assigned": ... 409` — the business rule. This is *not* an authorization check (the admin is definitely allowed to PATCH) and *not* a validation check (`"disabled"` is a perfectly valid status) — it's a rule about the **current state of this particular row**. `409 Conflict` is the right status code for "your request is valid, but it conflicts with the resource's current state." → [MDN: PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH).
- `execute("UPDATE spaces SET status = %s WHERE id = %s RETURNING ...", (status, space_id))` — one round trip to the database does both the change *and* fetches the updated row back, via `RETURNING`. That's the `execute()` helper from B3's `db.py`: it runs the SQL, commits, and returns the first row if the SQL ends in `RETURNING`. → [Postgres: `UPDATE`](https://www.postgresql.org/docs/current/sql-update.html).
- The response reshapes the row into the same `camelCase` `{"data": {...}}` envelope every other endpoint uses — `assigned_user_id` becomes `assignedUserId`, same as in B4.

> **Why is this route idempotent?** Sending `{"status":"disabled"}` to an already-`disabled` space just runs the same `UPDATE`, changes nothing, and returns the same `200`. Retrying a `PATCH` that already succeeded (e.g. because a response got lost on a flaky connection) is safe — it doesn't create a duplicate or double-apply anything. → [MDN Glossary: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent).

### Step 2 — The bulk route (~15 min)

Add this to the same file, `webapp/App/views/spaces.py`:

```python
@bp.patch("/api/spaces")
@require_role("admin")
def bulk_update_spaces():
    body = request.get_json(silent=True) or {}
    ids, status = body.get("ids"), body.get("status")
    if not isinstance(ids, list) or not ids or status not in ALLOWED:
        return _err("bad_request", "ids (non-empty list) and valid status required", 400)

    updated, skipped = [], []
    db = get_db()
    with db.cursor() as cur:
        for sid in ids:
            cur.execute("SELECT id, status FROM spaces WHERE id = %s", (sid,))
            row = cur.fetchone()
            if row is None:
                skipped.append({"id": sid, "reason": "not_found"}); continue
            if row["status"] == "assigned":
                skipped.append({"id": sid, "reason": "assigned"}); continue
            cur.execute("UPDATE spaces SET status = %s WHERE id = %s", (status, sid))
            updated.append({"id": sid, "status": status})
    db.commit()
    return jsonify({"data": {"updated": updated, "skipped": skipped}})
```

**Explanation, piece by piece:**
- `if not isinstance(ids, list) or not ids or status not in ALLOWED: ... 400` — three checks in one line: `ids` must actually be a list (not a single number, not a string), it must not be empty, and `status` must be one of the two allowed values. Same "validate before touching the database" order as Step 1.
- `db = get_db()` then `with db.cursor() as cur:` — this is one level lower than the `query()` / `execute()` helpers you've used everywhere else. Here you need to loop over the ids and decide, *one row at a time*, whether to update or skip it — the simple helpers don't support that, so this route talks to the cursor directly. It's the same `get_db()` from B3's `db.py`; you're just using it more directly.
- Inside the loop: fetch the row, and route it to exactly one of three outcomes — `skipped` with `"not_found"` if the id doesn't exist, `skipped` with `"assigned"` if the business rule blocks it, or an `UPDATE` plus an entry in `updated` if it's allowed. No single bad id in the list stops the rest from being processed.
- `db.commit()` — called **once**, after the loop finishes, not inside it. Every successful `UPDATE` in the loop becomes permanent together, in one trip to the database, instead of committing one row at a time.
- The response — `{"data": {"updated": [...], "skipped": [...]}}` — gives the admin a full picture in one response: exactly what changed, and exactly what didn't and why, instead of a single pass/fail flag for the whole batch.

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
   ```bash
   export A=<paste-an-admin-token>
   export S=<paste-a-student-token>
   ```
2. **Steps:**
   ```bash
   # bulk disable spaces 1,2,3 as admin
   curl -i -X PATCH http://localhost:8000/api/spaces \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
     -d '{"ids":[1,2,3],"status":"disabled"}'

   # confirm it stuck
   curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"

   # single re-enable
   curl -i -X PATCH http://localhost:8000/api/spaces/1 \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"status":"available"}'

   # a student must NOT be allowed
   curl -i -X PATCH http://localhost:8000/api/spaces/2 \
     -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"status":"available"}'

   # an invalid status must be rejected
   curl -i -X PATCH http://localhost:8000/api/spaces/1 \
     -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"status":"banana"}'
   ```
3. **Expected:**
   - Bulk → `200` with `updated:[1,2,3]`, `skipped:[]`; re-reading the lot shows spaces 1–3 `disabled`.
   - Single re-enable → `200`, space 1 back to `available`.
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
- **`409` on a space you expected to disable** — that space's status is already `assigned`. That's the business rule working as intended; it can't be disabled until it's unassigned (B7 handles that).
- **Both `PATCH` routes 404** — you likely skipped Step 3. Confirm `app.register_blueprint(spaces.bp)` is actually in `webapp/App/__init__.py`.
- **Bulk request returns everything in `skipped`** — double-check the ids you sent actually exist in your seeded data (B2), and that you're not accidentally sending them as strings when the column expects integers.
- **`curl` seems to "hang" or do nothing on the PATCH commands** — you forgot `-X PATCH`; without it `curl` defaults to `GET`, which this route doesn't support.

---

## 📝 Recap — what you built and learned

- You wrote the backend's **first write endpoints** — `PATCH` routes that actually change rows in PostgreSQL, not just read them.
- You saw two different kinds of "no" stacked on one route: **authorization** (`@require_role("admin")` — is this user allowed at all?) checked first, then a **business rule** (`assigned` can't be disabled — does this specific change make sense right now?) checked second.
- You built a **bulk endpoint** that reports partial success (`updated` / `skipped`) instead of failing an entire batch because of one bad id.
- You reused `execute()` with `RETURNING` for the single-item update, and went one level lower — a raw cursor and a single `db.commit()` — when the bulk route needed row-by-row decisions the simple helpers couldn't express.

---

## 📚 References

- [MDN: HTTP `PATCH` method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) — partial updates.
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789) — the formal spec `PATCH` follows.
- [Postgres: `UPDATE`](https://www.postgresql.org/docs/current/sql-update.html) — changing rows, with `RETURNING`.
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — role-based access control.
- [MDN Glossary: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent) — why retrying this route safely is fine.
- [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/) — registering the routes you wrote.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [backend guide → CR B5](../backend-development-guide.md#cr-b5--admin-enablesdisables-spaces).

---

## ➡️ Next lesson

**[Lesson B6 — Student registers interest](B6-student-registers-interest.md).** You'll build the first endpoint where a **student** writes data — registering interest in a parking spot — and add a duplicate-request guard so the same student can't create two pending requests at once. → [source CR](../backend-development-guide.md#cr-b6--student-registers-interest).
