# Lesson B8 — Save a lot's spot layout

> **Track:** Backend · **Lesson 9 of 10**
> **⏱ Time:** ~55 min · **🎚 Difficulty:** moderate (reuses B7's transaction pattern; the new idea is *reconciling* a whole set — add, move, delete — in one request).
> **🧩 Prerequisites:** you've done [Lesson B7 — Admin assigns a space](B7-admin-assigns-a-space.md) (JWT auth, `@require_role`, and the one-transaction write pattern). The `spaces` table already has `pos_x`, `pos_y`, `pos_w`, `pos_h`, `rotation` — they were designed into the B2 schema, so there's **no migration** in this lesson.
> **🌿 CR branch:** `cr/b8-layout` (off `cr/b7-assignments`) · **📄 Source CR:** [backend guide → CR B8](../backend-development-guide.md#cr-b8--save-lot-layout-spot-positions) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

One admin-only endpoint that saves *where every parking space sits on a lot's map, and how big it is*, so the layout stops being hard-coded in the front end and becomes real data an admin can author:

- **`PUT /api/lots/<id>/layout`** — body `{"spaces":[{"id"?, "label", "x", "y", "w"?, "h"?, "rotation"?}]}` → the server makes the lot's spaces match that list exactly: **update** the ones that have an `id`, **insert** the ones that don't, and **delete** the ones you left out — all inside **one transaction**.

The important, careful part: the endpoint **refuses to delete a space that's currently `assigned`** (returns `409` and writes nothing), so an admin rearranging a lot can never accidentally erase a space a student is parked in.

**✅ Done when (your deliverable checklist):**
- [ ] `PUT /api/lots/1/layout` with a valid admin token and a `spaces` array (some entries with `w`/`h`, some without) returns `200`, and re-reading the lot shows the saved `x`/`y`/`w`/`h`/`rotation`.
- [ ] Leaving a previously-saved space out of the array **deletes** it — unless it's `assigned`, in which case you get `409` and nothing changes.
- [ ] A coordinate outside `0..1`, or a missing label, returns `400`.
- [ ] A **student** token on this route gets `403`, same as every other admin route.
- [ ] Your work is committed on branch `cr/b8-layout` and pushed, PR base = `cr/b7-assignments`.

---

## 🤔 Why this lesson matters

In the UI prototype, where each space sits on the map comes from three developer-edited tables (`LOT_CONFIGS`, `LOT_MAP_CONFIGS`, `LOT_FAN_CONFIGS`). That means nobody but a programmer can move a spot — and several lots are stuck as photo-only because nobody hand-coded their grid. This endpoint turns "positions" from *code* into *data*: an admin drags spots on a map (that's the frontend, [U8](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/U8-place-and-arrange-spots.md)) and hits **Save Layout**, and this endpoint is what persists it.

Two design choices are worth slowing down on:

**Normalized coordinates *and* size.** We store `x`/`y` (position) **and `w`/`h` (size)** as **fractions between 0 and 1** (e.g. `x: 0.42, w: 0.05`), not pixels. A pixel position or width (`537px`, `40px`) only means something at one exact image size; the moment the map is zoomed, resized, or viewed on a phone, it's wrong. A fraction is "42% across, 5% wide, regardless of how big the image is drawn" — the front end multiplies both by the rendered size at paint time. Same reason a responsive layout uses `%` instead of hard pixel offsets. If a caller omits `w`/`h` (or sends one out of `0..1`), the server fills in a sane default rather than rejecting the save — see the `DEFAULT_SPOT_W`/`DEFAULT_SPOT_H` constants at `webapp/App/views/lots.py:14-15`.

**Full-replace instead of many small calls.** The admin edits the whole lot at once and saves once. So the client sends the *entire desired set* of spaces and the server figures out the difference — what to add, move, and remove. This is **idempotent**: sending the same layout twice leaves the database in the same place, no duplicates. It also keeps the browser simple — it doesn't have to remember "I created these two, moved that one, deleted this one" and fire three kinds of request; it just describes the end state.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **HTTP `PUT` & idempotency** | `PUT` means "make the resource look exactly like this"; doing it twice is the same as once. | [MDN: PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) · [MDN: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent) |
| **Normalized coordinates & size** | Position (`x`/`y`) *and* size (`w`/`h`) stored as `0..1` fractions of the image, so they survive zoom/resize. | [MDN: Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images) |
| **Reconciliation (upsert + delete)** | Compare the desired set to what's stored, then add/update/remove to match. | [PostgreSQL: UPDATE](https://www.postgresql.org/docs/current/sql-update.html) · [INSERT](https://www.postgresql.org/docs/current/sql-insert.html) |
| **Database transaction** | A group of writes that all succeed or all roll back (you met this in B7). | [psycopg3: Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) |
| **`= ANY(array)`** | One SQL condition that matches any id in a list — lets you delete many rows in one statement. | [PostgreSQL: arrays & ANY](https://www.postgresql.org/docs/current/functions-comparisons.html#FUNCTIONS-COMPARISONS-ANY-SOME) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → build the endpoint + understand reconciliation (30) → local testing (15) → commit & push (5).

**You need, from earlier lessons:** the server running (B1), the database seeded with the B2 schema — which already includes `spaces.pos_x/pos_y/pos_w/pos_h/rotation` (B2), login working (B3), and the `lots.py` blueprint you created in B4 (you'll add this endpoint to it).

> **📸 No migration in this lesson.** The position *and size* columns are part of the original schema (see the `spaces` table in [CR B2](../backend-development-guide.md#cr-b2--database-schema--seed-data)). If your database predates that and is missing them, re-run the B2 schema against your dev database, or add them by hand:
> ```sql
> ALTER TABLE spaces ADD COLUMN pos_x DOUBLE PRECISION, ADD COLUMN pos_y DOUBLE PRECISION,
>   ADD COLUMN pos_w DOUBLE PRECISION, ADD COLUMN pos_h DOUBLE PRECISION, ADD COLUMN rotation DOUBLE PRECISION;
> ```

**Branch off B7** (this CR stacks on it, not `main`):

```bash
git checkout cr/b7-assignments
git checkout -b cr/b8-layout
```

---

## 🛠 Build it, step by step

### Step 1 — Add the endpoint to `webapp/App/views/lots.py` (~30 min)

This goes in the **same** blueprint file you built in B4 — reuse its `bp`, its `_err` helper, and its imports. Add two small module-level pieces (the size defaults and a fraction check), a shared read helper, and the `PUT` handler:

```python
# add to webapp/App/views/lots.py
from ..db import query, query_one, get_db   # extend the existing import
from ..auth import require_role
from .. import serialize                     # B4's shared row -> JSON shapes

# Default slot size as a fraction of the map, for spots saved without a size.
DEFAULT_SPOT_W = 0.05
DEFAULT_SPOT_H = 0.03


def _is_frac(v):
    return isinstance(v, (int, float)) and 0 <= v <= 1


def _lot_spaces(lot_id):
    """Every space in a lot, serialized, ordered by id. Shared with B4's GET."""
    rows = query(serialize.SPACE_SELECT + " WHERE s.lot_id = %s ORDER BY s.id", (lot_id,))
    return [serialize.space(row) for row in rows]


@bp.put("/api/lots/<int:lot_id>/layout")
@require_role("admin")
def save_layout(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)

    body = request.get_json(silent=True) or {}
    incoming = body.get("spaces")
    if not isinstance(incoming, list):
        return _err("bad_request", "spaces (array) is required", 400)

    # Validate every entry BEFORE opening the transaction (fail fast).
    clean = []
    for s in incoming:
        label = s.get("label")
        x, y, rot = s.get("x"), s.get("y"), s.get("rotation")
        w, h = s.get("w"), s.get("h")
        if not isinstance(label, str) or not label.strip():
            return _err("bad_request", "each space needs a non-empty label", 400)
        if not _is_frac(x) or not _is_frac(y):
            return _err("bad_request", "x and y must be numbers in 0..1", 400)
        clean.append({
            "id": s.get("id"),                       # None => new space
            "label": label.strip(),
            "x": float(x), "y": float(y),
            "w": float(w) if _is_frac(w) else DEFAULT_SPOT_W,
            "h": float(h) if _is_frac(h) else DEFAULT_SPOT_H,
            "rotation": float(rot) if isinstance(rot, (int, float)) else 0.0,
        })

    keep_ids = {c["id"] for c in clean if isinstance(c["id"], int)}
    existing = query("SELECT id, status FROM spaces WHERE lot_id = %s", (lot_id,))
    to_delete = [row["id"] for row in existing if row["id"] not in keep_ids]
    # Refuse to delete a space that's currently assigned to a student.
    blocked = [row["id"] for row in existing
               if row["id"] in to_delete and row["status"] == "assigned"]
    if blocked:
        return _err("conflict", f"cannot delete assigned space(s): {blocked}", 409)

    db = get_db()
    try:
        with db.cursor() as cur:
            for c in clean:
                if isinstance(c["id"], int):
                    cur.execute(
                        "UPDATE spaces SET label=%s, pos_x=%s, pos_y=%s, pos_w=%s, "
                        "pos_h=%s, rotation=%s WHERE id=%s AND lot_id=%s",
                        (c["label"], c["x"], c["y"], c["w"], c["h"], c["rotation"],
                         c["id"], lot_id))
                else:
                    cur.execute(
                        "INSERT INTO spaces (lot_id, label, pos_x, pos_y, pos_w, pos_h, rotation) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                        (lot_id, c["label"], c["x"], c["y"], c["w"], c["h"], c["rotation"]))
            if to_delete:
                cur.execute("DELETE FROM spaces WHERE id = ANY(%s)", (to_delete,))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return jsonify({"data": {"lot_id": lot_id, "spaces": _lot_spaces(lot_id)}})
```

**Explanation, piece by piece:**

- **Validate first, on plain reads.** Everything before `get_db()` — the lot exists, `spaces` is a list, each label is non-empty, each `x`/`y` is a fraction — happens *outside* the transaction. By the time you start writing, every write is already known to be valid. This is the same fail-fast shape you used in B7. The `CHECK (... in 0..1)` constraints on `pos_x`/`pos_y`/`pos_w`/`pos_h` (from B2) are the database's own backstop if a bad value ever slips past this Python check.
- **`w`/`h` default instead of rejecting.** Unlike `x`/`y`, a missing or out-of-range `w`/`h` isn't a client error — it just means "use the standard spot size." `float(w) if _is_frac(w) else DEFAULT_SPOT_W` falls back to the module constants (`0.05`/`0.03`, ~5%×3% of the map) so every saved space always has a usable size, even from an older client that never sends `w`/`h` at all.
- **Reconciliation — the heart of the lesson.** `keep_ids` is the set of space ids the client still wants. Anything in the lot that's *not* in that set goes into `to_delete`. Then: entries **with** an `id` are `UPDATE`d (someone moved, resized, or relabeled an existing spot); entries **without** an `id` are `INSERT`ed (a brand-new spot). → [PostgreSQL UPDATE](https://www.postgresql.org/docs/current/sql-update.html) · [INSERT](https://www.postgresql.org/docs/current/sql-insert.html).
- **The `409` guard is the safety rule.** *Before* deleting anything, we check whether any to-be-deleted space is `assigned`. If so, we bail with `409` and write nothing — an admin can't erase a space a student is parked in without first unassigning it (B7's `DELETE`).
- **One transaction.** Every upsert and the delete run inside a single `with db.cursor() as cur:` block, committed once. If any statement fails, `db.rollback()` undoes the whole thing — you never get half a saved map. Same pattern as B7's assignment.
- **`= ANY(%s)`** deletes a whole list of ids in one statement; psycopg turns a Python list into a Postgres array for you. → [PostgreSQL ANY](https://www.postgresql.org/docs/current/functions-comparisons.html#FUNCTIONS-COMPARISONS-ANY-SOME).
- **The response reuses B4's serializer.** `_lot_spaces(lot_id)` re-reads every space with `serialize.SPACE_SELECT` and shapes each row with `serialize.space` — the same helper B4's `GET /api/lots/:id/spaces` uses — so the saved layout comes back with `x`/`y`/`w`/`h`/`rotation` plus `status`/`assigned_user_id`/`assigned_user_name`/`assigned_student_id`, re-read from the database (not echoed from the request), under `{"data": {"lot_id": ..., "spaces": [...]}}`.

> **No blueprint registration needed.** You're adding to `lots.py`, which `__init__.py` already registers (B4). New routes in an already-registered blueprint are live as soon as you restart the server.

---

## 🧪 Prove it works — testing guide

**Setup:** server running; `$A` = admin token; `$S` = student token; pick a lot id (e.g. `1`).

**macOS / Linux**

```bash
# save a two-spot layout (no ids => both are new spaces; A1 sets a custom size, A2 omits w/h)
curl -i -X PUT http://localhost:8000/api/lots/1/layout \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"spaces":[{"label":"A1","x":0.25,"y":0.4,"w":0.08,"h":0.05,"rotation":0},
                  {"label":"A2","x":0.6,"y":0.4,"rotation":90}]}'
# re-read: positions AND sizes persisted (A2 shows the default w/h)
curl -s http://localhost:8000/api/lots/1/spaces -H "Authorization: Bearer $A"
# a student may not save a layout -> 403
curl -i -X PUT http://localhost:8000/api/lots/1/layout \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' -d '{"spaces":[]}'
# out-of-range coordinate -> 400
curl -i -X PUT http://localhost:8000/api/lots/1/layout \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"spaces":[{"label":"X","x":9,"y":0.1}]}'
```

**Windows (PowerShell)** — `Invoke-RestMethod` throws on 4xx/5xx by default; add `-SkipHttpErrorCheck` (PowerShell 7.4+) to see the response body for the error-case steps below, the way `curl -i` does:

```powershell
# save a two-spot layout (no ids => both are new spaces; A1 sets a custom size, A2 omits w/h)
Invoke-RestMethod -Method Put http://localhost:8000/api/lots/1/layout -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' `
  -Body '{"spaces":[{"label":"A1","x":0.25,"y":0.4,"w":0.08,"h":0.05,"rotation":0},{"label":"A2","x":0.6,"y":0.4,"rotation":90}]}'
# re-read: positions AND sizes persisted (A2 shows the default w/h)
Invoke-RestMethod http://localhost:8000/api/lots/1/spaces -Headers @{Authorization="Bearer $A"}
# a student may not save a layout -> 403
Invoke-RestMethod -Method Put http://localhost:8000/api/lots/1/layout -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $S"} -ContentType 'application/json' -Body '{"spaces":[]}'
# out-of-range coordinate -> 400
Invoke-RestMethod -Method Put http://localhost:8000/api/lots/1/layout -SkipHttpErrorCheck `
  -Headers @{Authorization="Bearer $A"} -ContentType 'application/json' -Body '{"spaces":[{"label":"X","x":9,"y":0.1}]}'
```

**What you should see:**
- First `PUT` → `200`; the re-GET shows both spaces with their saved `x`/`y`/`rotation`, A1's `w`/`h` as `0.08`/`0.05`, and A2's `w`/`h` defaulted to `0.05`/`0.03` (`DEFAULT_SPOT_W`/`DEFAULT_SPOT_H`) since it sent none.
- To test delete: take an `id` from the re-GET, then `PUT` a layout that **includes** that id but omits another — the omitted one disappears on the next GET (unless it's `assigned` — see below).
- To test the guard: assign one of the spaces to a student (B7), then `PUT` a layout that omits it → `409`, and the space is still there.
- Student token → `403`; `x`/`y` outside `0..1` → `400`.

**☁️ Cloud check (optional):** after `./release.sh backend`, save a layout for a lot on the live server, then re-read it — positions persist in RDS. Best run end-to-end once the U8 editor exists (`./release.sh all`): drag spots, Save Layout, refresh, confirm they stay put.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B8: save lot layout (PUT /api/lots/:id/layout) with transactional full-replace"
git push -u origin cr/b8-layout
```

Open a Pull Request on GitHub with **base = `cr/b7-assignments`** (this CR stacks on B7, not `main` — see the [stacked-CR branching strategy](../../plan.md#81-cr-workflow--branching-strategy)). Paste your "Prove it works" output as testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). Record it in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## 🧯 If something breaks

- **`404` on `PUT /api/lots/1/layout` even though the route looks right** — make sure you added the handler to `lots.py` (already registered in B4) and restarted the server; a typo in the decorator path (`/layout`) also 404s.
- **Positions come back as `null` after saving** — you passed `x`/`y` at the top level instead of inside each space object, or your column names don't match (`pos_x`/`pos_y`/`pos_w`/`pos_h`/`rotation`). Re-read the exact request shape in the testing guide.
- **`w`/`h` come back as `0.05`/`0.03` even though you sent something else** — that's `DEFAULT_SPOT_W`/`DEFAULT_SPOT_H` kicking in: you either omitted `w`/`h` or sent a value outside `0..1`. The server treats that as "use the default size" rather than a `400` — send a fraction in `0..1` for a custom size.
- **A save wipes spaces you meant to keep** — remember this is *full-replace*: any existing space whose `id` you don't include gets deleted. To keep a space, include it (with its `id`) in the array.
- **`409` when you didn't expect it** — you're trying to delete (omit) a space that's currently `assigned`. Unassign it first (B7's `DELETE /api/assignments/:id`), then save the new layout.
- **`400` for a coordinate you think is fine** — `x`/`y` must be between 0 and 1 (fractions of the image), not pixels. `0.5` is the middle; `537` is invalid. (`w`/`h` never 400 — they just fall back to the default.)
- **`AttributeError`/`KeyError` on `g.user`** — `@require_role("admin")` didn't run; get a fresh admin token from B3.

---

## 📝 Recap — what you built and learned

- You built a **full-replace `PUT`** that reconciles a whole set of spaces — inserting new ones, updating moved/resized ones, and deleting omitted ones — instead of many small calls.
- You learned why position *and size* are stored as **normalized `0..1` fractions** (`x`/`y`/`w`/`h`) — they survive zoom/resize — and why a missing/out-of-range `w`/`h` gets a **default** (`DEFAULT_SPOT_W`/`DEFAULT_SPOT_H`) instead of a `400`.
- You reused B7's **one-transaction** pattern so a layout save is all-or-nothing, and added a **`409` guard** so rearranging can never delete an assigned space.
- You reused B4's **`serialize`** module (`SPACE_SELECT` + `serialize.space`) to shape the response, instead of hand-rolling another row → JSON mapping.
- You met `= ANY(array)` for deleting many rows in one statement.

---

## 📚 References

- [MDN — HTTP PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) and [Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent).
- [PostgreSQL — UPDATE](https://www.postgresql.org/docs/current/sql-update.html), [INSERT](https://www.postgresql.org/docs/current/sql-insert.html), [ANY/arrays](https://www.postgresql.org/docs/current/functions-comparisons.html#FUNCTIONS-COMPARISONS-ANY-SOME).
- [psycopg3 — Transactions](https://www.psycopg.org/psycopg3/docs/basic/transactions.html).
- [MDN — Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images) — why fractions beat pixels.
- Source of truth for this lesson: [backend guide → CR B8](../backend-development-guide.md#cr-b8--save-lot-layout-spot-positions).

---

## ➡️ Next lesson

The last backend lesson: **[B9 — Create a parking lot](B9-create-a-lot.md)** — a `POST /api/lots` that lets an admin add a brand-new lot (and its blank spaces), which the U9 UI then arranges with the editor you just powered.
