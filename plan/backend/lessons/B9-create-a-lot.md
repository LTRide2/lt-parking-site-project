# Lesson B9 — Create a parking lot

> **Track:** Backend · **Lesson 10 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** easy–moderate (three straightforward handlers; the new ideas are a create with two independent uniqueness checks, a delete that has to protect live data, and a file upload).
> **🧩 Prerequisites:** you've done [Lesson B8 — Save a lot's spot layout](B8-save-lot-layout.md) (the `lots.py` blueprint, `@require_role`, and the one-transaction write pattern).
> **🌿 CR branch:** `cr/b9-create-lot` (off `cr/b8-layout`) · **📄 Source CR:** [backend guide → CR B9](../backend-development-guide.md#cr-b9--create-a-parking-lot) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

> **New words ahead?** Terms like [status code](GLOSSARY.md#status-code), [transaction](GLOSSARY.md#transaction), and [foreign key](GLOSSARY.md#foreign-key) link to the shared [**Glossary**](GLOSSARY.md) the first time each lesson uses them — one plain-language sentence per word. Click through whenever a word is new; you never have to memorize one before the lesson needs it.

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

Three admin-only [endpoints](GLOSSARY.md#endpoint) that round out lot management — the app stops being frozen at the lots someone typed into the seed file, and a lot can be torn down as cleanly as it was stood up:

- **[`POST`](GLOSSARY.md#http-methods) `/api/lots`** (`backend/webapp/App/views/lots.py:124`) — body `{"name", "number"?, "capacity"?, "display_order"?}`. `name` is required; `display_order` defaults to `MAX(display_order)+1`; `number` defaults to that resolved `display_order` and must be unique. If `capacity` is given, seeds that many positionless `available` spaces labeled `<number>-<index>` (the admin arranges them later with B8's layout editor). Returns [`201`](GLOSSARY.md#status-code) with the new lot.
- **`DELETE /api/lots/<id>`** (`backend/webapp/App/views/lots.py:174`) — removes a lot, refusing with `409` if any of its spaces is currently `assigned`.
- **`POST /api/lots/<id>/map`** (`backend/webapp/App/views/lots.py:201`) — uploads a PNG/JPG map image for a lot and stores its URL. Backs the frontend's [U7 — Update the school map image](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U7-update-school-map.md).

**🖼 Before → after — what the API does:**

```text
BEFORE  — the route doesn't exist yet; the app can't add a lot
  $ curl -i -X POST http://localhost:8000/api/lots \
    -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
    -d '{"name":"North Lot","number":20,"capacity":10}'
  HTTP/1.1 404 NOT FOUND
  {"error":{"code":"not_found","message":"Not found"}}

AFTER   — the same request creates the lot (with its seeded spaces) and hands it back
  $ curl -i -X POST http://localhost:8000/api/lots \
    -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
    -d '{"name":"North Lot","number":20,"capacity":10}'
  HTTP/1.1 201 CREATED
  {"data":{"id":<newId>,"name":"North Lot","number":20,"display_order":<newId>,"map_image_url":null,"capacity":10,"available_count":10}}
```

**✅ Done when (your deliverable checklist):**
- [ ] `POST /api/lots` with a valid admin token, a `name`, a `number`, and a `capacity` returns `201`; `GET /api/lots` lists it and `GET /api/lots/<newId>/spaces` shows `capacity` spaces labeled `<number>-1`, `<number>-2`, ….
- [ ] A blank name returns `400`; a duplicate name (any case) *or* a duplicate `number` returns `409`.
- [ ] `DELETE /api/lots/<id>` on a lot with no assigned spaces returns `204` and it drops out of `GET /api/lots`.
- [ ] `DELETE /api/lots/<id>` on a lot with an assigned space returns `409` and changes nothing.
- [ ] `POST /api/lots/<id>/map` with a PNG or JPG returns `200` with an absolute `map_image_url` you can open directly in a browser.
- [ ] A **student** token gets `403` on all three routes.
- [ ] Your work is committed on branch `cr/b9-create-lot` and pushed, PR base = `cr/b8-layout`.

---

## 🤔 Why this lesson matters

Every endpoint you've built so far either *read* data or *edited* rows that the B2 seed already created. `POST /api/lots` is the first one that **creates a brand-new top-level resource** — a row that didn't exist before. It's a small shift with a big payoff: the app stops being limited to the lots hard-coded in a seed file and becomes something the school can grow on its own.

It's also the lesson that finishes lot management end to end. On its own, "create a lot" gives you an empty, mapless lot — not very useful. But this same lesson also ships the map upload, so a lot gets a photo behind it ([U7](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U7-update-school-map.md) is the UI that calls it), and B8/U8 arrange its spots. And when a lot outlives its usefulness — a construction closure, a renumbering — `DELETE /api/lots/<id>` tears it down again, with the same care B8's layout delete taught you: it refuses to erase a spot a student is actually parked in.

One theme carries through all three endpoints: **the server is the real boundary.** The UI ([U9](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U9-add-a-parking-lot.md)) will grey out the Create button for a blank name and the Remove button when a lot has an assigned space, but that's UX only. Each endpoint still has to enforce its own rule, because a determined client (or a bug) can send anything.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`POST` to create a resource** | The HTTP verb that asks the server to make a new thing and return it (usually `201 Created`). | [MDN: POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) · [201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201) |
| **Server-side validation** | The client blocks obvious mistakes for UX, but the server enforces the real rules. | [OWASP: Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) |
| **`409 Conflict`** | The status for "this can't be done because of current state" — here, a duplicate name/number on create, or an assigned space blocking a delete. | [MDN: 409](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409) |
| **Seeding child rows in a transaction** | Creating a parent (lot) and its children (spaces) together, all-or-nothing. | [psycopg3: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) |
| **`ON DELETE CASCADE` vs `SET NULL`** | Two different foreign-key behaviors for what happens to a child row when its parent is deleted — cascade removes it, `SET NULL` keeps it but orphans the reference. | [PostgreSQL: Foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) |
| **`multipart/form-data` file upload** | The HTTP encoding for sending a binary file (plus any form fields) in a request body. | [MDN: Using FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects) |
| **MIME-type allow-listing** | Checking the browser-reported content type against a fixed allow-list before trusting an uploaded file. | [OWASP: File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, create (15) → Step 2, delete (10) → Step 3, map upload (15) → local testing (10) → commit & push (5).

**You need, from earlier lessons:** the server running (B1), the B2 schema + seed, login (B3), and the `lots.py` blueprint (B4, extended in B8). You'll add all three endpoints to that same file.

**Branch off B8** (this CR stacks on it, not `main`):

```bash
git checkout cr/b8-layout
git checkout -b cr/b9-create-lot
```

---

## 🛠 Build it, step by step

### Step 1 — Create a lot (~15 min)

Add the `POST` handler to the same blueprint (the imports, `_err`, and `serialize` module are already there from B4/B8):

```python
# add to backend/webapp/App/views/lots.py
@bp.post("/api/lots")                        # decorator: POST creates a new lot
@require_role("admin")                       # only an admin token may call this
def create_lot():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    number = body.get("number")
    capacity = body.get("capacity")
    display_order = body.get("display_order")
    if not name:
        return _err("bad_request", "name is required", 400)   # blank/whitespace name
    if number is not None and (not isinstance(number, int) or number < 0):
        return _err("bad_request", "number must be a non-negative integer", 400)
    if capacity is not None and (not isinstance(capacity, int) or capacity < 0):
        return _err("bad_request", "capacity must be a non-negative integer", 400)
    if query_one("SELECT id FROM lots WHERE lower(name) = lower(%s)", (name,)):
        return _err("conflict", "A lot with that name already exists", 409)  # case-insensitive dup

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            # Default display_order to the end, and the lot number to that order.
            cursor.execute("SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM lots")
            next_order = cursor.fetchone()["next"]
            resolved_order = display_order if isinstance(display_order, int) else next_order
            resolved_number = number if isinstance(number, int) else resolved_order
            cursor.execute("SELECT id FROM lots WHERE number = %s", (resolved_number,))
            if cursor.fetchone():
                connection.rollback()
                return _err("conflict", f"Lot number {resolved_number} is already in use", 409)
            cursor.execute(                              # create the lot row itself
                "INSERT INTO lots (name, number, display_order) VALUES (%s, %s, %s) "
                "RETURNING id, name, number, display_order, map_image_url",
                (name, resolved_number, resolved_order))
            lot = cursor.fetchone()
            for index in range(1, (capacity or 0) + 1):  # seed capacity blank spaces, no position yet
                cursor.execute(
                    "INSERT INTO spaces (lot_id, label) VALUES (%s, %s)",
                    (lot["id"], f"{resolved_number}-{index}"))
        connection.commit()                              # lot + spaces saved together, or not at all
    except Exception:
        connection.rollback()
        raise

    lot["capacity"] = capacity or 0
    lot["available_count"] = capacity or 0
    return jsonify({"data": serialize.lot(lot)}), 201     # 201 Created + the new lot
```

**Why it works & further reading:**

- **Name required, then de-duplicated.** A blank/whitespace name is `400`; a case-insensitive duplicate is `409`. → [OWASP: Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- **`number` defaults to `display_order`, both re-checked for uniqueness inside the same [transaction](GLOSSARY.md#transaction) as the insert** — a duplicate rolls back instead of committing a half-made lot. → [psycopg3: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html)
- **`capacity` seeds positionless spaces** labeled `<number>-<index>`; B8/U8 give them a position later.
- **One transaction, one `commit()`** — the lot and its spaces are inserted together, so a mid-way failure rolls back the whole create instead of leaving it half-built.
- **`serialize.lot(...)`** (`backend/webapp/App/serialize.py:40`) matches `GET /api/lots`'s shape, so the create [response](GLOSSARY.md#response) looks identical to a normal list entry.

> **No blueprint registration needed** — `lots.py` is already registered (B4). Restart the server and the route is live.

### Step 2 — Delete a lot (~10 min)

```python
# add to backend/webapp/App/views/lots.py
@bp.delete("/api/lots/<int:lot_id>")          # decorator: DELETE removes a lot
@require_role("admin")                       # admin only
def delete_lot(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)   # lot doesn't exist
    assigned = query(                                     # guard: any assigned space blocks the delete
        "SELECT label FROM spaces WHERE lot_id = %s AND status = 'assigned'", (lot_id,))
    if assigned:
        labels = ", ".join(row["label"] for row in assigned)
        return _err("conflict", f"cannot remove a lot with assigned space(s): {labels}", 409)

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            # Drop this lot's interest rows first; spaces (and their assignments)
            # cascade when the lot is deleted.
            cursor.execute("DELETE FROM interest WHERE lot_id = %s", (lot_id,))
            cursor.execute("DELETE FROM lots WHERE id = %s", (lot_id,))
        connection.commit()                               # interest cleanup + lot delete together
    except Exception:
        connection.rollback()
        raise
    return "", 204                                         # nothing to return
```

**Why it works & further reading:**

- **Guard first, mutate second.** Any `assigned` space blocks the whole delete with `409`, listing labels so the admin knows what to unassign first (B7's `DELETE /api/assignments/<id>`). Nothing is written if this trips.
- **`interest` is deleted explicitly, `spaces` isn't.** `spaces.lot_id` and `assignments.space_id` are `ON DELETE CASCADE` (`backend/webapp/sql/migrations/001_init.sql:60,95`), so they vanish for free; `interest.lot_id` is `ON DELETE SET NULL` (`:80`), so it's cleaned up in the same transaction to avoid an orphaned [foreign key](GLOSSARY.md#foreign-key). → [PostgreSQL: Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- **`204 No Content`** — the right status for a delete with nothing to return. → [MDN: 204](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204)

### Step 3 — Upload a lot's map image (~15 min)

```python
# add to backend/webapp/App/views/lots.py
@bp.post("/api/lots/<int:lot_id>/map")        # decorator: POST uploads a lot's map image
@require_role("admin")                       # admin only
def upload_map(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)   # lot doesn't exist

    uploaded = request.files.get("file")               # multipart/form-data field "file"
    if uploaded is None or not uploaded.filename:
        return _err("bad_request", "a file is required", 400)
    if uploaded.mimetype not in ("image/png", "image/jpeg"):
        return _err("bad_request", "Only PNG or JPG images are allowed", 400)  # allow-list

    extension = ".png" if uploaded.mimetype == "image/png" else ".jpg"
    filename = secure_filename(f"lot_{lot_id}{extension}")   # fixed name overwrites any prior map
    uploads_dir = os.path.join(current_app.static_folder, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    uploaded.save(os.path.join(uploads_dir, filename))       # write to App/static/uploads/

    # Store an absolute URL so the SPA (served from another origin) can load it.
    # Use execute (not query_one) so the UPDATE is committed, not rolled back.
    url = request.host_url.rstrip("/") + "/static/uploads/" + filename
    row = execute(
        "UPDATE lots SET map_image_url = %s WHERE id = %s "
        "RETURNING id, name, number, display_order, map_image_url", (url, lot_id))
    counts = query_one(
        "SELECT count(*) AS capacity, "
        "count(*) FILTER (WHERE status='available') AS available_count "
        "FROM spaces WHERE lot_id = %s", (lot_id,))
    row["capacity"] = counts["capacity"]
    row["available_count"] = counts["available_count"]
    return jsonify({"data": serialize.lot(row)})          # 200: existing lot updated, not created
```

**Why it works & further reading:**

- **`multipart/form-data`, field `file`.** A file upload isn't JSON, so Flask exposes it via `request.files`, not `request.get_json()`. → [MDN: Using FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects)
- **PNG/JPG only, checked by MIME type** on the [request](GLOSSARY.md#request) — anything else is `400` before a byte hits disk; there's no size cap yet, worth adding before this faces the open internet. → [OWASP: File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- **Fixed filename (`secure_filename`)** — a new upload for the same lot overwrites the old image instead of piling up orphans.
- **Absolute URL, not a relative path** — built from `request.host_url` because the SPA is served from a different origin than the API; a relative path would resolve against the wrong host.
- **`execute`, not `query_one`.** `backend/webapp/App/db.py:38`'s `execute()` commits itself; `query_one` never does, so it would silently roll the `UPDATE` back. `200`, not `201` — this updates an existing lot, it doesn't create one.

> **No blueprint registration needed** for either of these — same file, same already-registered blueprint.

---

## 🧪 Prove it works — testing guide

**Setup:** server running; `$A` = admin token; `$S` = student token.

**macOS / Linux**

```bash
# create: name + number + capacity -> 201, seeded spaces
curl -i -X POST http://localhost:8000/api/lots \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"name":"North Lot","number":20,"capacity":10}'
curl -s http://localhost:8000/api/lots -H "Authorization: Bearer $A"          # new lot listed
curl -s http://localhost:8000/api/lots/<newId>/spaces -H "Authorization: Bearer $A"  # 20-1 .. 20-10

# blank name -> 400 ; duplicate name -> 409 ; duplicate number -> 409 ; student -> 403
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"name":"   "}'
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"name":"North Lot"}'
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"name":"South Lot","number":20}'
curl -i -X POST http://localhost:8000/api/lots -H "Authorization: Bearer $S" \
  -H 'Content-Type: application/json' -d '{"name":"Sneaky"}'

# delete: empty lot -> 204 ; lot with an assigned space -> 409
curl -i -X DELETE http://localhost:8000/api/lots/<newId> -H "Authorization: Bearer $A"
curl -i -X DELETE http://localhost:8000/api/lots/1 -H "Authorization: Bearer $A"   # Lot 1 has A8 assigned

# map upload: PNG -> 200 with an absolute map_image_url
curl -i -X POST http://localhost:8000/api/lots/1/map \
  -H "Authorization: Bearer $A" -F "file=@/path/to/image.png"
```

**Windows (PowerShell)** — `Invoke-RestMethod` throws on 4xx/5xx by default; add `-SkipHttpErrorCheck` (PowerShell 7.4+) to see the response body for the error-case steps below, the way `curl -i` does:

```powershell
# create: name + number + capacity -> 201, seeded spaces
Invoke-RestMethod -Method Post http://localhost:8000/api/lots -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' `
  -Body '{"name":"North Lot","number":20,"capacity":10}'
Invoke-RestMethod http://localhost:8000/api/lots -Headers @{Authorization="Bearer $A"}          # new lot listed
Invoke-RestMethod http://localhost:8000/api/lots/<newId>/spaces -Headers @{Authorization="Bearer $A"}  # 20-1 .. 20-10

# blank name -> 400 ; duplicate name -> 409 ; duplicate number -> 409 ; student -> 403
Invoke-RestMethod -Method Post http://localhost:8000/api/lots -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"name":"   "}'
Invoke-RestMethod -Method Post http://localhost:8000/api/lots -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"name":"North Lot"}'
Invoke-RestMethod -Method Post http://localhost:8000/api/lots -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"name":"South Lot","number":20}'
Invoke-RestMethod -Method Post http://localhost:8000/api/lots -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $S"} -ContentType 'application/json' -Body '{"name":"Sneaky"}'

# delete: empty lot -> 204 ; lot with an assigned space -> 409
Invoke-RestMethod -Method Delete http://localhost:8000/api/lots/<newId> -Headers @{Authorization="Bearer $A"}
Invoke-RestMethod -Method Delete http://localhost:8000/api/lots/1 -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"}   # Lot 1 has A8 assigned

# map upload: PNG -> 200 with an absolute map_image_url
Invoke-RestMethod -Method Post http://localhost:8000/api/lots/1/map `
  -Headers @{Authorization="Bearer $A"} -Form @{file=Get-Item 'C:\path\to\image.png'}
```

**What you should see:**
- First `POST` → `201` with the new lot (`number: 20`); `GET /api/lots` now includes it; `GET /api/lots/<newId>/spaces` returns 10 positionless `available` spaces labeled `20-1`..`20-10`.
- Blank name → `400`; duplicate name → `409`; duplicate number → `409`; student token → `403`.
- `DELETE` on the freshly-created (empty) lot → `204`, and it drops out of `GET /api/lots`.
- `DELETE` on Lot 1 (seed's A8 is `assigned` to Alice) → `409` listing `A8`.
- Map upload → `200` with `map_image_url` like `http://127.0.0.1:8000/static/uploads/lot_1.png` — paste that URL into a browser tab and the image loads.

**☁️ Cloud check (optional):** after `scripts/deploy.sh app backend`, create a lot on the live server and re-list — it persists in RDS. Full loop with the UI (`scripts/deploy.sh app all`): create a lot (U9) → upload its map (U7) → arrange its spots (B8/U8) → log in as a student and confirm the new lot shows up.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B9: create/delete a parking lot + upload its map (POST/DELETE /api/lots, POST /api/lots/:id/map)"
git push -u origin cr/b9-create-lot
```

Open a Pull Request on GitHub with **base = `cr/b8-layout`** (this CR stacks on B8, not `main`). Paste your "Prove it works" output. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). Record it in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## 🧯 If something breaks

- **`409` on your first create** — a lot with that name or number already exists (the name check is case-insensitive, so "North Lot" clashes with "north lot"). Pick a different name/number or delete the existing lot.
- **New lot has no spaces** — that's expected if you didn't pass `capacity`. Either pass one, or add spaces later by saving a layout (B8/U8).
- **`400` for a capacity/number you think is valid** — both must be whole non-negative numbers; `"10"` as a string or `10.5` will be rejected. Send them as JSON numbers: `"capacity": 10, "number": 20`.
- **`403`** — you're not logged in as an admin, or the token isn't attached; get a fresh admin token from B3.
- **`DELETE` keeps returning `409`** — one of the lot's spaces is `assigned`; unassign it first (B7's `DELETE /api/assignments/<spaceId>`) and retry.
- **Map upload returns `400`** — the file's reported content type isn't `image/png` or `image/jpeg`; a `.jpg` renamed from a `.gif`, or a form field named anything other than `file`, will trip this. Check the request in your network tab.
- **Uploaded map doesn't load in the browser** — confirm you're opening the *absolute* URL the response returned (`http://<host>:<port>/static/uploads/lot_<id>.<ext>`), not a relative guess; and that `backend/webapp/App/static/uploads/` actually contains the file.

---

## 📝 Recap — what you built and learned

- You built the app's **first "create a new resource" endpoint** (`POST /api/lots`), returning `201` with the created lot — validated server-side with two independent uniqueness checks (name, number) plus non-negative-integer checks on `number` and `capacity`.
- You **seeded child rows** (optional blank spaces, labeled `<number>-<index>`) alongside the parent lot in **one transaction**.
- You added the matching **`DELETE /api/lots/<id>`**, learning why a delete sometimes has to clean up manually (`interest`, `SET NULL`) and sometimes gets it for free (`spaces`/`assignments`, `CASCADE`) — same table, two different foreign-key contracts.
- You added a **file-upload endpoint** (`POST /api/lots/<id>/map`), validating a MIME type, saving to a fixed filename, and returning an **absolute** URL so a cross-origin SPA can actually load the image.
- You saw how these three endpoints **compose** with U7 (map) and B8/U8 (arrange) into a full "stand up, illustrate, arrange, and eventually tear down a lot" workflow instead of duplicating them.
- **This is the last backend lesson.** Between B0 and B9 you've built the whole API: config, health, schema, auth, reads, admin writes, interest, assignment, layout, and lot lifecycle.

---

## 📚 References

- [MDN — HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST), [201 Created](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201), and [204 No Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204).
- [MDN — 409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409).
- [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) and [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- [PostgreSQL — Foreign Keys (`ON DELETE` actions)](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK).
- [MDN — Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects).
- [psycopg3 — Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- Source of truth for this lesson: [backend guide → CR B9](../backend-development-guide.md#cr-b9--create-a-parking-lot).

---

## ➡️ Next lesson

**That's the whole backend track — every endpoint the app needs is built.** From here:

- Build the site that calls this API: the [UI track](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/README.md), including [U7](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U7-update-school-map.md) (map upload), [U8](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U8-place-and-arrange-spots.md) (drag-and-drop arrange), and [U9](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U9-add-a-parking-lot.md) (add/remove a lot) that pair with the endpoints you just built.
- Or put this backend online: the [Deploy track at Lesson D0 — AWS account setup](../../deploy/lessons/D0-aws-account-setup.md).
