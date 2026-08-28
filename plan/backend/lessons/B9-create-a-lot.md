# Lesson B9 — Create a parking lot

> **Track:** Backend · **Lesson 10 of 10**
> **⏱ Time:** ~45 min · **🎚 Difficulty:** easy–moderate (a straightforward `POST` that creates a resource; the new idea is validating a create and optionally seeding child rows).
> **🧩 Prerequisites:** you've done [Lesson B8 — Save a lot's spot layout](B8-save-lot-layout.md) (the `lots.py` blueprint, `@require_role`, and the one-transaction write pattern).
> **🌿 CR branch:** `cr/b9-create-lot` (off `cr/b8-layout`) · **📄 Source CR:** [backend guide → CR B9](../backend-development-guide.md#cr-b9--create-a-parking-lot) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

One admin-only endpoint that adds a **brand-new parking lot** to the system, so the app is no longer frozen at the 17 lots someone typed into the seed file:

- **`POST /api/lots`** — body `{"name", "capacity"?, "display_order"?}` → inserts the lot and, if `capacity` is given, that many blank `available` spaces (positionless — the admin places them later with B8's layout editor). Returns the new lot.

**✅ Done when (your deliverable checklist):**
- [ ] `POST /api/lots` with a valid admin token and a name returns `201` and the new lot; `GET /api/lots` then lists it.
- [ ] Passing `capacity: 10` also creates 10 spaces you can see via `GET /api/lots/<newId>/spaces`.
- [ ] A blank name returns `400`; a duplicate name returns `409`.
- [ ] A **student** token gets `403`, same as every other admin route.
- [ ] Your work is committed on branch `cr/b9-create-lot` and pushed, PR base = `cr/b8-layout`.

---

## 🤔 Why this lesson matters

Every endpoint you've built so far either *read* data or *edited* rows that the B2 seed already created. This is the first one that **creates a brand-new top-level resource** — a row that didn't exist before. It's a small shift with a big payoff: the app stops being limited to the lots hard-coded in a seed file and becomes something the school can grow on its own.

It's also the piece that makes the last three CRs click together into one workflow. On its own, "create a lot" gives you an empty, mapless lot — not very useful. But you already built the tools that finish the job: **U7** puts a photo behind it and **B8/U8** place its spots. So the real story is: create a lot (this CR) → upload its map (U7) → arrange its spots (B8/U8). Recognizing when a new feature should *hand off* to features you already have — instead of re-implementing them — is a habit worth building.

One more theme carries over from every admin CR: **the server is the real boundary.** The UI will disable the Create button for a blank name, but that's only a convenience. This endpoint still has to reject a blank or duplicate name itself, because a determined client (or a bug) can send anything.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`POST` to create a resource** | The HTTP verb that asks the server to make a new thing and return it (usually `201 Created`). | [MDN: POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) · [201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201) |
| **Server-side validation** | The client blocks obvious mistakes for UX, but the server enforces the real rules. | [OWASP: Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) |
| **`409 Conflict`** | The status for "this can't be done because of current state" — here, a duplicate name. | [MDN: 409](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409) |
| **Seeding child rows in a transaction** | Creating a parent (lot) and its children (spaces) together, all-or-nothing. | [psycopg3: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) |
| **`COALESCE`** | SQL function returning the first non-null argument — used here to auto-pick a `display_order`. | [PostgreSQL: COALESCE](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → build the endpoint (20) → local testing (15) → commit & push (5).

**You need, from earlier lessons:** the server running (B1), the B2 schema + seed, login (B3), and the `lots.py` blueprint (B4, extended in B8). You'll add this endpoint to the same file.

**Branch off B8** (this CR stacks on it, not `main`):

```bash
git checkout cr/b8-layout
git checkout -b cr/b9-create-lot
```

---

## 🛠 Build it, step by step

### Step 1 — Add the endpoint to `webapp/App/views/lots.py` (~20 min)

Add the `POST` handler to the same blueprint (the imports and `_err` are already there from B4/B8):

```python
# add to webapp/App/views/lots.py
@bp.post("/api/lots")
@require_role("admin")
def create_lot():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    capacity = body.get("capacity")
    display_order = body.get("display_order")
    if not name:
        return _err("bad_request", "name is required", 400)
    if capacity is not None and (not isinstance(capacity, int) or capacity < 0):
        return _err("bad_request", "capacity must be a non-negative integer", 400)
    # Case-insensitive duplicate check (app-level; see note below).
    if query_one("SELECT id FROM lots WHERE lower(name) = lower(%s)", (name,)):
        return _err("conflict", "A lot with that name already exists", 409)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO lots (name, display_order) VALUES (%s, "
                "  COALESCE(%s, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM lots))) "
                "RETURNING id, name, display_order, map_image_url",
                (name, display_order))
            lot = cur.fetchone()
            for i in range(1, (capacity or 0) + 1):
                cur.execute(
                    "INSERT INTO spaces (lot_id, label) VALUES (%s, %s)",
                    (lot["id"], f"{lot['id']}-{i}"))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return jsonify({"data": {
        "id": lot["id"], "name": lot["name"],
        "displayOrder": lot["display_order"],
        "mapImageUrl": lot["map_image_url"],
        "capacity": capacity or 0, "availableCount": capacity or 0,
    }}), 201
```

**Explanation, piece by piece:**

- **Name required, then de-duplicated.** A blank/whitespace name is `400`; a name that already exists (compared case-insensitively with `lower(...)`) is `409`. The client will grey out the button for blanks, but this is the real gate. → [OWASP: Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).
- **`capacity` is optional and validated.** If present it must be a non-negative integer; otherwise `400`. When given, the loop inserts that many `available` spaces with **no** position (`pos_x/pos_y` stay `NULL`) — the admin arranges them in B8/U8. Leave it out and you get an empty lot to fill in later.
- **`COALESCE` auto-orders the lot.** If the caller doesn't pass `display_order`, `COALESCE(%s, (SELECT MAX+1))` puts the new lot at the end of the nav order. → [PostgreSQL COALESCE](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL).
- **One transaction.** The lot insert and all the space inserts share one `with db.cursor()` block and one `commit()`. If any space insert fails, the lot insert rolls back too — you never get a lot with a half-built set of spaces. Same all-or-nothing guarantee as B7/B8.
- **`201 Created`** is the right status for "I made a new thing," and we return the created lot so the UI (U9) can immediately select it. → [MDN: 201](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201).

> **Note — race-proofing the unique name.** The app-level `SELECT`-then-`INSERT` has a tiny window where two admins could create "North Lot" at the same instant and both pass the check. For a school-scale app that's fine. To let the *database* enforce it, add `CREATE UNIQUE INDEX lots_name_lower ON lots (lower(name));` (in a new migration) and catch `psycopg.errors.UniqueViolation` → `409`, exactly the trick B7 uses for assignments. Deferred to the hardening CRs unless you want it now.

> **No blueprint registration needed** — `lots.py` is already registered (B4). Restart the server and the route is live.

---

## 🧪 Prove it works — testing guide

**Setup:** server running; `$A` = admin token; `$S` = student token.

```bash
curl -i -X POST http://localhost:8000/api/lots \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"name":"North Lot","capacity":10}'
curl -s http://localhost:8000/api/lots -H "Authorization: Bearer $A"     # new lot listed
# use the id from the first response:
curl -s http://localhost:8000/api/lots/<newId>/spaces -H "Authorization: Bearer $A"  # 10 blank spaces
# blank name -> 400 ; duplicate -> 409 ; student -> 403
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"name":"   "}'
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"name":"North Lot"}'
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $S" \
  -H 'Content-Type: application/json' -d '{"name":"Sneaky"}'
```

**What you should see:**
- First `POST` → `201` with the new lot; `GET /api/lots` now includes it; `GET /api/lots/<newId>/spaces` returns 10 positionless `available` spaces.
- Blank name → `400`; duplicate name → `409`; student token → `403`.

**☁️ Cloud check (optional):** after `./release.sh backend`, create a lot on the live server and re-list — it persists in RDS. Full loop with the UI (`./release.sh all`): create a lot (U9) → upload its map (U7) → arrange its spots (B8/U8) → log in as a student and confirm the new lot shows up.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B9: create a parking lot (POST /api/lots)"
git push -u origin cr/b9-create-lot
```

Open a Pull Request on GitHub with **base = `cr/b8-layout`** (this CR stacks on B8, not `main`). Paste your "Prove it works" output. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). Record it in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## 🧯 If something breaks

- **`409` on your first create** — a lot with that name already exists (the check is case-insensitive, so "North Lot" clashes with "north lot"). Pick a different name or delete the existing one.
- **New lot has no spaces** — that's expected if you didn't pass `capacity`. Either pass one, or add spaces later by saving a layout (B8/U8).
- **`400` for a capacity you think is valid** — it must be a whole non-negative number; `"10"` as a string or `10.5` will be rejected. Send it as a JSON number: `"capacity": 10`.
- **`403`** — you're not logged in as an admin, or the token isn't attached; get a fresh admin token from B3.
- **New lot doesn't show in `GET /api/lots`** — confirm the `POST` returned `201` (not an error you missed) and that you committed the transaction; re-run the list call.

---

## 📝 Recap — what you built and learned

- You built the app's **first "create a new resource" endpoint** (`POST /api/lots`), returning `201` with the created lot.
- You validated a create the right way: **server-side** name/capacity checks, `400` for bad input, `409` for a duplicate — with the client's checks treated as UX only.
- You **seeded child rows** (optional blank spaces) alongside the parent lot in **one transaction**.
- You saw how this CR **composes** with U7 (map) and B8/U8 (arrange) into a full "stand up a lot from scratch" workflow instead of duplicating them.
- **This is the last backend lesson.** Between B0 and B9 you've built the whole API: config, health, schema, auth, reads, admin writes, interest, assignment, layout, and lot creation.

---

## 📚 References

- [MDN — HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) and [201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201).
- [MDN — 409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409).
- [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).
- [PostgreSQL — COALESCE](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL).
- [psycopg3 — Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- Source of truth for this lesson: [backend guide → CR B9](../backend-development-guide.md#cr-b9--create-a-parking-lot).

---

## ➡️ Next lesson

**That's the whole backend track — every endpoint the app needs is built.** From here:

- Build the site that calls this API: the [UI track](../../ui/lessons/README.md), including [U8](../../ui/lessons/U8-place-and-arrange-spots.md) (drag-and-drop arrange) and [U9](../../ui/lessons/U9-add-a-parking-lot.md) (add a lot) that pair with the two endpoints you just built.
- Or put this backend online: the [Deploy track at Lesson D0 — AWS account setup](../../deploy/lessons/D0-aws-account-setup.md).
