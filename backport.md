# Frontend / UI POC fixes (fold into `plan/ui/lessons/`)

**What this is.** This proof-of-concept built the **frontend SPA** (repo
`lt-parking-site-project`) against an independent mock backend (`src/api/mock/backend.ts`,
persisted to `localStorage`) — no real backend needed. The fixes below are gaps between
what the U-lessons say and what the running UI needs. Code references point at this SPA
repo; targets are the `plan/ui/lessons/` files (keep both synced plan trees byte-identical).
Items U-1/U-2 are "the tutorial crashes / looks broken as written"; the rest are missing
features a learner would otherwise never build.

> **Where things live (2026-08-28).** UI/frontend fixes belong **in this file**
> (`lt-parking-site-project/backport.md`). Backend/server fixes belong in
> `~/workspace/LT_Proj/LTR-Backend/backport.md`. Any UI change that also needs a real-backend
> contract change notes the backend requirement inline here **and** should be cross-checked
> against the backend file.

## U-1. Blank page = temporal-dead-zone crash at module init  ⚠️ blocker

Module-init `let database = load()` where `load()` calls a `save()` that reassigns
`database` before its declaration finishes → `ReferenceError: Cannot access 'database'
before initialization`, blanking the whole app (only on fresh/empty `localStorage`).
**Fix:** split the write into a standalone `persist(db)` that touches only its argument;
move `let database = load()` below the function declarations. Backport as a
module-init-ordering troubleshooting note in the mock-backend lesson.

## U-2. Add an ErrorBoundary around the app shell  ⚠️ blocker-adjacent

A runtime render error otherwise blanks the page silently. `src/ErrorBoundary.tsx` shows
the message + stack on-screen; wired outermost in `src/main.tsx`. Backport into **U2**
(routing/app shell) as a build step plus a troubleshooting pointer.

## U-3. Data-contract field names must be consistent snake_case

`available_count, lot_id, user_id, map_image_url, display_order, created_at,
assigned_user_id`. Lessons mix styles — reconcile in **U3** (§ lots/spaces) and **U5**
(§ availability). Matches backend item #3 in the backend backport file.

## U-4. `GET /lots/:id/spaces` envelope shape

Frontend expects `{ lot_id, spaces: [...] }`, not a bare array. Pin the envelope in **U3**.

## U-5. Arrange: add an explicit "➕ Add Spot" button

Click-on-map was the only way to add a spot — undiscoverable. Add a labeled button that
drops a spot at center `(0.5, 0.5)`; route it and the map-click through one
`addSpotToDraft(x, y)` helper. Target **U8**.

## U-6. Arrange: make spot dragging robust

Binding pointermove/up to the tiny spot with `setPointerCapture` on the spot drops the
drag the moment the cursor leaves the box ("not moveable"). Capture the pointer on the map
**container** and track move/up there, keyed by a `draggingRef`; suppress the drag-release
click with a `suppressClickRef` so ending a drag doesn't also add a spot. Target **U8**.

## U-7. Control-panel button gating: don't double-gate on Edit Mode

Original gated lot-action buttons on `isEditMode && selectedLotId != null`, so selecting a
lot left everything disabled until you also flipped Edit Mode — reads as broken. Activate
the panel on lot selection (`isControlPanelActive = selectedLotId != null`); gate
lot-scoped actions on `selectedLotId == null` (plus a selection for Disable/Enable). Keep
Edit Mode as optional editing chrome (pink border + Cancel), not a hard gate. Target **U3/U4**.

## U-8. Store slot SIZE as normalized fractions (w, h), not fixed px

Root cause of "slots don't keep ratio to the map": position was normalized (x, y ∈ 0..1)
but size was hardcoded `26×12px`, so slots didn't scale with the map. Add `w, h` (fractions
of map width/height) to the space/layout contract; render slot size as `%` of the map
container; default ~`0.05 × 0.03`. **Key teaching point:** you do NOT need to persist the
map's zoom scale — because x/y/w/h are all fractions of the map, position AND size stay
consistent at any display size; arrange-time zoom is purely a placement convenience.
Contract: `PUT /lots/:id/layout` accepts `w,h` per space and `GET /lots/:id/spaces` returns
them. Target **U8** + the data contract in **U3**. (Real backend needs `pos_w/pos_h`
columns alongside the `pos_x/pos_y/rotation` of backend item #3.)

## U-9. Per-slot resize in the arrange editor

The drawn slot rarely matches the space painted on the map photo, and the admin shouldn't
rescale the whole map to fit a fixed slot. Give the picked draft spot resize controls:
uniform Bigger/Smaller (×1.15 / ×0.87) plus Wider/Narrower and Taller/Shorter (±~0.006
fraction steps), clamped ~0.01..0.6. Depends on U-8's w/h model. Target **U8**.

## U-10. Lot-view map zoom (buttons)

The selected-lot map was fixed-size, so no expand/shrink. Add a lot-view zoom (−/%/＋/Reset)
that scales the map by driving the `<img>` **width** (`width: 620*zoom px`, `height:auto`) —
because spots are positioned in normalized %, resizing the image keeps them aligned. Reset
zoom in the nav click handlers (NOT a setState-in-effect — eslint
`react-hooks/set-state-in-effect` forbids it). Applies to authored view, arrange, and the
fallback grid. Target **U3/U7/U8**.

## U-11. Lot-view pan (drag) + mouse-wheel zoom — use the SAME transform model as Home

The campus/Home view drags freely in any direction and wheel-zooms; the lot view had only
the zoom buttons ("moving the map by mouse and my wheel does not work"). **Key lesson: give
the lot view the identical mechanism the campus view already uses — a CSS `translate` offset,
not scroll.** A first attempt used an `overflow:auto` scroll container (`scrollLeft/scrollTop`),
which only pans along axes where the content actually *overflows*: a map taller-but-narrower
than the canvas panned vertically but not horizontally, and showed a lone vertical scrollbar —
reads as broken. Scroll is the wrong model.

The working design in `src/ControlBoard.tsx`:
- Container is `overflow: hidden` (no scrollbars at all).
- The map (+ its spots) sits in a `translate(${lotOffset.x}px, ${lotOffset.y}px)` layer with
  `transform-origin: 0 0`; `onLotMouseDown/onLotMouseMove/endLotPan` update `lotOffset` by the
  drag delta — free 2D pan regardless of map size. A drag past a ~4px threshold sets a `moved`
  flag so `handleSpaceClick` ignores the release click.
- **Pan works in arrange mode too** (drag the *empty* map to pan; drag a *spot* to move it).
  These don't conflict because a spot's `pointerdown` fires before the map's `mousedown` and
  sets `draggingRef`; `onLotMouseDown` starts a pan only when `draggingRef` is null. Same
  translate layer, so panning and spot-dragging coexist and spot coords (`%` of the map box)
  stay correct after a pan.
- Keep the toolbar OUTSIDE the translate layer so it stays put while the map moves.
- Wheel-zoom is attached imperatively with `{ passive: false }` (React `onWheel` is passive) and
  is **cursor-anchored** like Home: read the current zoom/offset from a ref mirror (the listener
  closure is stale otherwise), compute `ratio = next/prev`, and shift the offset by
  `cursor*(1-ratio)` using the map layer's `getBoundingClientRect()` so the point under the
  cursor stays fixed. Reset (button + lot switch) zeroes both `lotZoom` and `lotOffset`.

Target **U3/U7/U8** — extends U-10. (Zoom itself is still width-based per U-10; only pan +
wheel-anchoring are added here.)

## U-13. Arrange: click-on-map must NOT create a spot

Click-to-add-a-spot (the original U8 gesture) is error-prone once the map is also draggable —
stray clicks litter the lot with spots. Make the **➕ Add Spot** button (U-5) the *only* way to
add; drop the map's `onClick` add handler entirely (and the `suppressClickRef` that existed only
to swallow the drag-release click). Update the arrange hint to "Press ➕ Add Spot … · drag a spot
to move it". Target **U8** — supersedes the "click the map to add" wording from U-5.

## U-14. Arrange: the new spot's info (label) is set in the panel, and is editable

"How do we determine the new spot's information?" A new spot gets an auto-suggested label
(`S1, S2, …`), and the arrange panel shows a **Label** text field bound to the picked spot
(`renamePicked`) so the admin renames it before Save Layout. The label is the spot's identity in
the layout payload. Target **U8** (+ the `PUT /lots/:id/layout` contract already carries `label`).

## U-15. Arrange: only remove a spot that isn't assigned

Deleting a space that's currently assigned would orphan that person's spot. Gate the arrange
**Delete** button: disabled (with an explanatory note) when the picked spot maps to an existing
space whose status is `assigned` (`isSpaceAssigned`); `deletePicked` also hard-refuses. The real
backend's layout-replace / delete-space path must enforce the same rule server-side (reject
removing an assigned space, or require unassigning first). Target **U8** + a guard note in the
layout endpoint (B8/B-layout).

## U-12. Hover tooltip with slot summary (incl. arrange mode)

Replace the native `title` attr with a floating, cursor-following tooltip showing
`Spot <label> — Assigned to <name> / Available / Disabled`. The **arrange** editor shows it
too: an existing draft spot shows its status/assignee, an unsaved one shows its size as
`w%×h% of map` (`draftHoverProps`/`draftSummary` in `src/ControlBoard.tsx`). Requires the
spaces contract to include **`assigned_user_name`** (add to the mock's `serializeSpace`; the
real backend's `GET /lots/:id/spaces` must return the assignee's name, or the frontend
resolves it from a users source). Pin `assigned_user_name` in the **U3** data contract.
Target **U3** (+ **U8** for the arrange-mode tooltip).

## U-16. Pin the sidebar so a zoomed map can't shrink it

Zooming the map (esp. in arrange) shrank the left control sidebar. Classic flexbox trap:
the fixed-width `aside` had no `flex-shrink: 0`, and `main` had no `min-width: 0`, so a wide
map's content demand stole width from the shrinkable sidebar. Fix: `flex-shrink: 0` on the
sidebar and `min-width: 0` on `main` (its inner canvas is already `overflow: hidden`, so it
absorbs the overflow instead of pushing layout). Target the U-lesson that builds the admin
control-board layout (**U3**, control-board shell).

## U-17. Lots carry an admin-assigned `number` that prefixes spot labels  (contract change)

New requirement: when creating a lot the admin sets a **lot number** (in addition to the
name), and every spot added to that lot is labelled with it as a prefix (`7-1, 7-2, …`).
Frontend (`src/ControlBoard.tsx` + `parkingSlice`): the Add-Lot modal has a "Lot number
(optional)" field; `createLot` sends `number`; arrange's `addSpotToDraft` labels new spots
`${lot.number}-${n}`. Mock backend: `MockLot.number`, `POST /api/lots` accepts+validates
`number` (non-negative int, **unique** across lots, defaults to `display_order` if omitted),
default-capacity spaces and the seed's positionless spaces label as `${lot.number}-${index}`,
`serializeLot` returns `number`.

**Backend to build:** add a `number` column to `lots` (unique, admin-set); `POST /lots`
validates and stores it and rejects duplicates (409); label auto-generated spaces
`<number>-<n>`; `GET /lots` returns `number`. Reconcile in **U3/U9** and the lots table in
the B-schema (B2) + create-lot CR (B-lots). (Mock storage key bumped **v2→v3** to reseed with
the new shape — the plan's reset instructions should name the current key.)

## U-18. Remove a lot — only if none of its spaces are assigned  (new endpoint)

New requirement: admin can delete a lot, blocked when any space in it is assigned. Frontend:
a gated **🗑 Remove Lot** button (disabled + note when `spaces` has an `assigned` one), a
`window.confirm`, and a `deleteLot` thunk hitting `DELETE /api/lots/:id`; on success the
selection resets to Home. Mock backend: `DELETE /api/lots/:id` returns **409** if any space
is assigned, else removes the lot + its spaces + its interest rows (204).

**Backend to build:** `DELETE /lots/:id` (admin) — reject with 409 when the lot has assigned
spaces; otherwise cascade-delete the lot's spaces (and interest rows referencing it). Mirrors
the existing "can't delete an assigned space" guard on the layout endpoint (backend backport
#3 / B8). Add as a CR under **U9/B-lots**; document the 409 in the API reference.

## U-19. Update School Map: uploaded image must persist (data URL, not blob: URL)  ⚠️ POC bug

The mock's map upload stored `URL.createObjectURL(file)` as `map_image_url`. A `blob:`
URL is valid only for the current page session — it renders once but is dead after a
refresh and is meaningless once persisted to `localStorage`, so the uploaded map "does
not load." **Fix (mock only):** `mockUpload` reads the File as a base64 **data URL**
(`FileReader.readAsDataURL`) before storing it, so it survives `save()`/reload.

Two distinct bugs here:
- **(a) Persistence (mock only):** never persist a `URL.createObjectURL` result — it's
  session-scoped, so the map renders once but breaks on refresh and is dead weight in
  localStorage. Use a base64 data URL (`FileReader.readAsDataURL`). A real backend
  persists the file and returns a durable URL, so it has no blob-lifetime bug.
- **(b) Render gating (frontend, U-lesson-relevant):** `renderLotBody` rendered
  `map_image_url` ONLY in the arrange view and the authored-layout view. A lot with no
  spaces (early `return "No spaces"`) or positionless spaces (fallback grid) never drew
  the `<img>`, so a freshly uploaded map "didn't load." Fix: a `mapImg()` helper renders
  the map in EVERY lot view that has one — no-spaces, fallback grid, authored, arrange.
  The U-lesson that builds the lot map view must show the map whenever it exists, not
  only when a layout is authored.

Caveat to note in the lesson: the mock's `persist()` swallows `QuotaExceededError`, and
base64 inflates size ~33% — several multi-MB uploads can exceed the ~5MB localStorage
quota and silently fail to persist (fine in-session). Target the mock-backend upload
lesson under **U8/U-10** (map upload) + the lot-map render section (U3/U8).

## U-20. Arrange: rotate CW **and** CCW by an adjustable angle (default 15°)

The arrange editor had a single "Rotate 15°" (clockwise-only, fixed step). Now: a **↺ CCW**
and a **CW ↻** button plus an **Angle** number input (default **15**, 1–180) that sets the
degrees per click. `rotatePicked(direction: 1 | -1)` applies `step * direction` and
normalizes to `0–359` (`((r + delta) % 360 + 360) % 360`) so CCW doesn't go negative.
Pure placement affordance — no contract change; `rotation` still rides the existing
`PUT /lots/:id/layout` payload. Target **U8** (arrange editor) — extends the rotate control.

## U-21. Available (unassigned) slot color = yellow, not white

`spaceColor` returned `white` for an available space, which washed out against a light
map photo. Changed available → **`#ffeb3b`** (yellow). Legend/status colors are now:
available = yellow, assigned = blue (`#7aa7ff`), disabled = grey (`#aaa`), selected = gold
(`#f5c542`). Pure styling — no contract change. Fold into whatever U-lesson documents the
slot status legend (**U3/U4**).

## U-22. Manual Assign: pick WHICH student to approve — show names, scope to the lot  (contract change)

The capability existed (Manual Assign → click a pending request → click a space) but was
unusable when several students wanted the same lot: the pending list rendered each request
as `#<user_id>` (a raw number) and mixed all lots together, so "choose which student to
approve" wasn't apparent. Fixes:
- **Contract:** `GET /api/interest` items now include **`user_name`** (mock `serializeInterest`
  looks it up from the requester). The real backend's interest/waitlist list endpoint must
  return the student's name (join users), or the frontend must resolve it. Pin `user_name`
  in the interest payload in **U5** (interest/availability) + the API reference.
- **UI (`ControlBoard.tsx`):** the Manual Assign panel splits **"Requests for this lot (N)"**
  (clickable, **sorted earliest-first** = first-come order, shown by name) from **"Requests
  for other lots"** (read-only hint to switch lots). Picking one shows "Approving <name> —
  now click an available space".
- **Bug closed:** `handleSpaceClick` now also requires `pickedInterest.lot_id === selectedLotId`
  before assigning, so a stale pick from another lot can't be assigned into the wrong lot.
- Seed now has two pending requests on one lot (Lot 4) so the choice is demoable.

Target **U5** (contract) + **U4/U7** (manual-assign UI).

## U-23. Unassign a student and reassign them to another slot

Admin needs to free an assigned space and move that student to a different slot. Endpoint
already existed (`DELETE /api/assignments/:spaceId`) but only freed the space; **it now
also reverts that student's fulfilled interest for the lot back to `pending`** so they
re-enter the queue and can be reassigned via Manual Assign. Frontend: a new **Unassign**
edit mode (`editAction: 'unassign'`, disabled when the lot has no assigned space) —
clicking an assigned (blue) space confirms, calls `unassignSpace({spaceId, lotId})`, then
refreshes spaces + pending interest. A stale pick guard was also added
(`handleSpaceClick` requires `pickedInterest.lot_id === selectedLotId`).

**Backend to build:** `DELETE /assignments/:spaceId` (admin) must (a) set the space
available / clear its assignee AND (b) flip the corresponding interest/waitlist row back to
`pending` (or whatever the "still waiting" state is) so the student can be reassigned. If
the schema tracks assignments separately from interest, delete/close the assignment and
reopen the request. Target **U4/U7** (assign UI) + the assignments CR (B-assign) and the
API reference.

## U-24. Arrange mode: color draft spots by status (available = yellow, assigned = blue)

Extends U-21. In the Arrange editor all draft spots were one blue color. Now each draft
spot is colored by the status of its backing space — assigned = blue
(`rgba(122,167,255,.85)`), available/new-unsaved = yellow (`rgba(255,235,59,.8)`) — so the
arrange view matches the lot view's legend. Pure styling; uses `isSpaceAssigned(spot.id)`.
Target **U8** (arrange editor).

## U-25. Admin menu: group actions into sub-panels + add button tooltips

The flat sidebar (Single Select / Disable / Enable / Manual Assign / Unassign as separate
top-level buttons) was confusing. Reorganized to the Arrange-Spots pattern — a mode button
that reveals a sub-panel:
- **"Single Select" → "Slot Enable/Disable"**: mode button; **Disable/Enable** buttons moved
  OFF the main menu into its sub-panel (act on the selected spots; shows the selection count).
- **"Manual Assign" → "Assign to Spot"**: mode button; **Unassign** removed from the main menu
  and folded into this one mode — in `handleSpaceClick`, clicking an assigned (blue) spot
  unassigns, clicking an available (yellow) spot with a picked request assigns. The sub-panel
  explains both. (`editAction: 'unassign'` removed from the union.)
- Every main-menu button gained a `title=` tooltip describing what it does.

Pure UI/IA — no contract change. Fold the menu structure + tooltip guidance into the U-lesson
that builds the admin control board (**U3/U4/U7**).

## U-26. Student roster (Student Management): table + CRUD + CSV batch import

New admin-managed **student roster**, separate from the login/auth user record. The PoC
seeds it and links it to the assignment identity by matching the login user's `code` to the
student's `student_id`.

**Data model — new `students` table.** Business primary key is **`student_id`** (string, e.g.
`STUxxx` / `Sxxxxxx`), *not* email. Columns:
`id, first, last, student_id (unique), email, grade (number 9–12, stored as string),
assigned_slot (display text "Lot 1 · A8" | null), parking_status`.
`parking_status ∈ {unassigned, valid, expired, suspended}` and denotes **whether the student
paid / holds a slot**: `valid` = assigned a slot, `suspended` = parking suspended,
`unassigned` = no slot / unassigned by admin, `expired` = parking expired. Default on create =
`unassigned`, slot `null`.

**Endpoints (all admin):**
- `GET /api/students?q=` — search by **name substring OR student_id substring**
  (case-insensitive), sorted by last then first.
- `POST /api/students` — create; `first,last,student_id` required; 409 on duplicate
  `student_id` (case-insensitive); defaults `assigned_slot=null, parking_status=unassigned`; 201.
- `PATCH /api/students/:id` — edit `first,last,email,grade,student_id,parking_status`;
  `student_id` uniqueness re-checked; `parking_status` validated against the enum.
- `DELETE /api/students/:id` — 404 if missing else 204.
- `POST /api/students/import` (multipart CSV, columns `First,Last,studentId,email,grade`) —
  **upsert keyed by `student_id`**: existing rows updated, new rows added; header row optional;
  returns a summary `{ added, updated, errors[] }` (per-row errors for missing First/Last/id).

**Roster stays in sync with assignment.** On assign the matched student's
`assigned_slot`/`parking_status` go to the slot text + `valid`; on unassign they clear to
`null` + `unassigned`. Admin can still hand-set `valid/suspended/expired` in the UI.

**Real backend:** add the `students` entity, the CRUD + CSV-import endpoints, and join
`student_id` to the login/assignment identity (the PoC's `user.code === student.student_id`
shim becomes a real FK). Target a new **U-lesson** (student roster) + the assignment CR so
assign/unassign updates the roster.

## U-27. Assign / move a roster student directly to a lot spot (no interest request)

Gap found after U-23: unassign returns a student's request to the pending queue **scoped to
the old lot**, so there was no way to place a student into a *different* lot — or to place a
student who never filed an interest request (e.g. a CSV-imported one).

**Frontend:** Student Management gains a per-row **Assign / Move** action → pick any lot →
pick an available spot → confirm. Button reads "Assign" when the student has no slot, "Move"
when they already hold one.

**Contract:**
- Space gains **`assigned_student_id`** (roster `student_id` | null) alongside
  `assigned_user_id`, so a spot can be held by a roster student **with no login account**;
  `serializeSpace` falls back to the roster student's name for `assigned_user_name` when there
  is no login user.
- New endpoint `POST /api/students/:id/assign { spaceId }` (admin): space must be `available`
  (else 409); **frees any spot the student already holds first** (so it's a move, reverting the
  old lot's fulfilled interest back to pending); sets the space assigned to the student (and to
  their login user if one exists); sets roster `assigned_slot` + `parking_status=valid`; if the
  student has a login account, points their active pending interest at the new lot and fulfils it.
- `POST /api/assignments` now also stamps `assigned_student_id` (from the user's `code`), and
  `DELETE /api/assignments/:spaceId` clears it and the roster slot via either identity.

**Real backend:** add `assigned_student_id` (nullable FK to the student roster) to the space/
assignment record, and a direct assign-student-to-space endpoint that enforces one-slot-per-
student (move semantics). Target the assignment CR + the U-lesson from U-26.

## U-28. Student Management: download roster as CSV (round-trips with U-26 import)

Admin can **Download CSV** of the listed students in the exact import columns
(`First,Last,studentId,email,grade`), edit in a spreadsheet, and re-upload via the U-26
import — a clean round trip. PoC builds the CSV client-side (Blob + object URL, quote-escaping
cells) from the currently displayed (search-filtered) list.

**Real backend (optional):** a `GET /api/students/export.csv` (admin) could stream the same
columns server-side for large rosters / server-side filtering; otherwise the frontend export
is sufficient. No required contract change. Target the U-26 student-roster lesson.

## U-29. "Assign to Spot" view: unassign OR move an assigned spot's request to another lot

Follow-up to U-27: the move feature existed only in Student Management; admins also expected
it in the map's **Assign to Spot** mode. Now clicking an assigned (blue) spot **selects** it
(instead of firing an immediate unassign confirm) and the sub-panel offers **Unassign** or
**Move request to another lot**. Per the admin's chosen model, move asks for the **target lot
only** (not a target spot) — it frees the current spot and re-queues the request as *pending*
in the new lot; the admin then assigns a spot there via the normal flow (keeps one assign path).

**New endpoint** `POST /api/assignments/move { fromSpaceId, toLotId }` (admin): source space
must be `assigned` (409 else); frees it (clears `assigned_user_id` + `assigned_student_id`);
sets the roster slot to null + `parking_status=unassigned` (they're unassigned until re-placed);
re-points the occupant's fulfilled interest (for the old lot) to the new lot as **pending**, or
opens a fresh pending request if the login user had none. Occupants with no login user (direct
roster assignment, no interest) are simply freed — they're moved via Student Management instead.

**Real backend:** add the move endpoint (or model it as unassign + re-open request at the new
lot in one transaction). Do NOT auto-assign a spot — the request returns to pending so the
admin picks the spot. Target the assignment CR (alongside U-23/U-27).

## U-30. Student self-service: browse the map and request specific spots

Before this, the student side was a plain list of lots with a single "Register interest"
button per lot (`registerInterest(lotId)`) — the student couldn't see the actual lot layout
or say *which* spot they wanted. Rewrote `src/StudentDashboard.tsx` into a **map view that
mirrors the admin's** (campus map → lot navigation → per-lot spot rendering with the same
pan/zoom techniques) but **without the admin sidebar**. **A student may request exactly ONE
spot** — clicking an available (yellow) spot picks it (turns green) and replaces any prior
pick; clicking the picked spot clears it. A "Your selection" panel names the chosen spot +
**Submit request** and **Clear selection**. A top banner summarizes the student's current
request (`lot_name · space_labels — status`). Opening the lot the student already has a
request in pre-loads their picked spot.

**Locked-after-submit / withdraw-to-change flow:** once a request is submitted, spot selection
on the map AND the Submit/Clear controls are **disabled** — the side panel flips to a read-only
"Your request" card showing the requested spot + approval status. The student changes their spot
only by clicking **Withdraw request**, which **rescinds** the original interest (sets it
`cancelled`) and re-enables selection so they can pick again and submit fresh. Withdraw is
offered **only while the status is `pending`**; once `fulfilled` (approved/assigned) it is fully
locked ("contact an admin to change"). Status is shown with human labels: `pending → Pending
approval`, `fulfilled → Approved — spot assigned`, `cancelled → Withdrawn`.

**Contract changes** (interest now carries the student's chosen spots):
- `Interest` gains `space_ids: number[]` and `space_labels: string[]` (labels for display).
  Kept as arrays for now, but a request holds **at most one** spot (see the 400 below).
- `POST /api/interest { lotId, spaceIds }` (student): validates the requested spot belongs to
  the lot AND is currently `available` — `400` if none picked, **`400` if more than one spot is
  sent** (only one may be requested), `409` if the chosen spot is no longer available.
  **Upserts** the student's active pending request (one active at a time): updates its lot +
  spot if a pending one exists, else creates a new pending request. Returns the serialized
  interest with `space_ids`/`space_labels`.
- `DELETE /api/interest/me` (student): sets the active pending request to `cancelled` (204).
- `GET /api/lots/:id/spaces` is login-gated (any authenticated user), **not** admin-only, so
  students can read the layout to choose spots. Confirm the real backend authorizes students
  to read spaces (read-only) for lots they can request.

**Real backend:** store the preferred spot on the interest/request row; validate spot
availability + lot membership at request time (return 400/409 as above); **enforce a single
requested spot** (reject >1); enforce one active request per student (upsert semantics); expose
withdraw. The status lifecycle drives the client lock: while `pending` the student may withdraw
(rescind) and re-request; once `fulfilled` the request is immutable from the student side (admin
must change it). The admin assign flow (U-22/U-23) can then show the student's preferred spot as
a hint when placing them.

## U-31. Student lot view: hover tooltip with lot number + availability

Student map spots used a bare native `title` (`label — status`). Added the same floating
cursor-following tooltip the admin view has (see U-12), showing **lot number · spot label ·
availability** (`Available` / `Taken` / `Unavailable` / `Selected by you`).
Frontend-only (`hoverProps(space)` on both the authored-layout and fallback-grid spots + a
fixed-position `tip` element). Real backend already returns everything needed (`lots.number`,
space `status`); no contract change.

**Seed/demo (POC-local, storage key bumped v5→v6):** added two student **login** accounts so
the student flow has more test users — `STU003 → Andrew` and `STU004 → Olivia` (login code =
`code`). Aligned the roster rows for those `student_id`s to the same names/emails so the
`user.code === student.student_id` link stays consistent. Real backend seeds its own fixtures;
not a lesson beyond "keep the auth user ↔ roster student link consistent when seeding".

## UI — Do NOT backport (POC-local)

- **Scoped `log()` helper** (`src/lib/log.ts`) traces API calls + control state in devtools,
  toggle off via `localStorage['ltride.log']='off'`. A diagnostic aid, not lesson material —
  leave out unless we add a dedicated "debugging" appendix.
