# Lesson U8 — Place & arrange parking spots (drag-and-drop layout editor)

> **Track:** Frontend · **Lesson 9 of 10**
> **⏱ Time:** ~75 min · **🎚 Difficulty:** hard (your first drag-and-drop UI and the first time the app *authors* map data instead of just displaying it)
> **🧩 Prerequisites:** you've done [Lesson U7 — Update the school map image](U7-update-school-map.md); the backend's layout endpoint (`PUT /api/lots/:id/layout`, backend **B8**) running.
> **🌿 CR branch:** `cr/u8-arrange-spots` (off `cr/u7-map-upload`) · **📄 Source CR:** [ui guide → CR U8](../ui-development-guide.md#cr-u8--place--arrange-parking-spots-drag-and-drop-layout-editor) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Today, **where** each parking spot sits on a lot's map is frozen in code — three hand-tuned tables at the top of `ControlBoard.tsx` (`LOT_CONFIGS`, `LOT_MAP_CONFIGS`, `LOT_FAN_CONFIGS`) that only a developer can edit, one pixel at a time. By the end of this hour an **admin** can, in the browser, **add a spot by clicking the map, drag it to the right place, rotate it, delete it, and press Save** — and the layout is stored on the server so it survives a refresh and shows for everyone.

Concretely, you will have:

- New `x`, `y`, `rotation` fields on the `Space` type — a spot's position stored as **normalized** coordinates (`0..1` of the map image), so it stays correct at any zoom or screen size.
- An **"Arrange Spots"** edit action that turns the selected lot's map into an editable canvas: click-to-add, drag-to-move, a small rotate control, and a Delete for the picked spot.
- A **Save Layout** button that `PUT`s the whole lot's spots to `/api/lots/:id/layout`, plus the optimistic-update-then-refetch pattern from U4.
- A rendering path that draws a lot **from its saved layout** when it has one, and falls back to the old hard-coded config tables for lots that don't.

**✅ Done when (your deliverable checklist):**
- [ ] In Edit Mode, **Arrange Spots** makes the current lot's map editable; clicking an empty area adds a new spot where you clicked.
- [ ] You can **drag** any spot to a new position and it stays put when you release the mouse.
- [ ] You can select a spot and **rotate** it and **delete** it.
- [ ] **Save Layout** persists the arrangement; after a **refresh** the spots are exactly where you left them.
- [ ] Zooming/resizing the window does **not** move the spots relative to the map (coordinates are normalized, not raw pixels).
- [ ] A lot with **no** saved layout still renders via the old config tables (no regression to Lots you haven't arranged yet).
- [ ] Work committed on `cr/u8-arrange-spots` and pushed, PR base = `cr/u7-map-upload`.

---

## 🤔 Why this lesson matters

Up to now the app has been a **viewer**: it fetches data the server owns (lots, spaces, statuses) and paints it. The spot *positions*, though, were never data — they were source code. That's why adding or moving a spot meant a developer editing `LOT_MAP_CONFIGS` and redeploying, and why several lots are stuck as "map-only" (a photo with no clickable grid) in the prototype. This lesson flips positions from **code** into **data an admin can author**, which is the difference between a demo and a tool the school can actually run.

Two ideas do the heavy lifting:

1. **Normalized coordinates.** We never store "spot is at pixel (417, 232)" — that's meaningless the moment the image is scaled, zoomed, or shown on a different screen. We store a fraction: `x = 0.63, y = 0.41` means "63% across, 41% down the map image." To draw it we multiply by the image's *rendered* size; to save a drag we divide the drop point by that same size. The number is stable forever. This is the same instinct behind the existing `MAP_DISPLAY_SCALE` math, made into real data.
2. **Author-then-persist.** Dragging updates local React state instantly (so it feels direct), but nothing is real until **Save Layout** sends the whole set to the server and we refetch the truth back — the exact optimistic pattern you built in [U4](U4-enable-disable-saves.md).

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Pointer events & dragging** | `onPointerDown/Move/Up` (with `setPointerCapture`) is the modern, mouse-and-touch way to implement drag without losing the element when the cursor moves fast. | [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · [MDN: setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) |
| **`getBoundingClientRect()`** | Reads an element's on-screen size/position so you can convert a mouse point into a fraction of the image. | [MDN: getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) |
| **Normalized coordinates** | Storing position as `0..1` of a container instead of raw pixels, so it survives resize/zoom. | [Game/graphics term; see "normalized device coordinates"](https://en.wikipedia.org/wiki/Normalized_device_coordinates) |
| **CSS transforms (`translate`, `rotate`)** | Positioning and rotating a box without changing layout flow — how each spot is placed on the map. | [MDN: transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform) |
| **Optimistic UI update** | Update the screen immediately, then confirm with the server and roll back on failure (reused from U4). | [Redux Toolkit: async logic](https://redux-toolkit.js.org/usage/usage-guide#async-requests-with-createasyncthunk) |
| **Idempotent `PUT` (replace)** | Sending the *whole* desired layout so the server ends in a known state regardless of what was there before. | [MDN: PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) |

---

## ✅ Before you start

**Time budget for the hour+:** setup & branch (5 min) → Step 1, types + thunk (15) → Step 2, editable canvas + drag (25) → Step 3, add/rotate/delete + Save (20) → test & commit (15).

You need **U7** merged (or on your machine) and backend **B8** running — the endpoint that persists a lot's layout. This CR **depends on** both.

> **📸 What's already in the prototype:** `ControlBoard.tsx` positions spots three ways today — a plain grid (`LOT_CONFIGS`), a rotated map-crop overlay (`LOT_MAP_CONFIGS`), and a curved "fan" (`LOT_FAN_CONFIGS`), all hard-coded, and it has a `MAP_ONLY_LOTS` set for lots shown as a photo with no grid. **Keep all of that as the fallback.** This lesson adds a *new, higher-priority* path: if the server sends spots that carry `x`/`y`, we draw from those instead. Nothing you built in U3–U7 is thrown away.

**The backend contract this lesson calls (backend B8):**

- `GET /api/lots/:id/spaces` now returns each space with optional `x`, `y` (floats `0..1`) and `rotation` (degrees). Legacy spaces have them `null`.
- `PUT /api/lots/:id/layout` — body `{ spaces: [{ id?: number, label: string, x: number, y: number, rotation?: number }] }`. The server **replaces** the lot's spot set in one transaction: entries with an `id` are updated, entries without one are created, and existing spaces missing from the list are deleted. It refuses to delete a space that is currently `assigned` (returns `409`), so you can't strand a student's spot. Returns the updated `Space[]`.

**Make your branch.** U8 continues from U7:

```bash
git checkout cr/u7-map-upload
git checkout -b cr/u8-arrange-spots
```

---

## 🛠 Build it, step by step

### Step 1 — Add position fields + a save-layout thunk to `parkingSlice.ts` (~15 min)

First, extend the `Space` type so a spot can carry its position (from U3):

```ts
export interface Space {
  id: number;
  lot_id: number;
  label: string;
  status: "available" | "disabled" | "assigned";
  x?: number | null;         // 0..1 across the map image (null = legacy, use config fallback)
  y?: number | null;         // 0..1 down the map image
  rotation?: number | null;  // degrees
}
```

Now add the thunk that saves a whole lot's layout. Put it next to `updateSpaces`:

```ts
// PUT /api/lots/:id/layout  body { spaces: [{id?, label, x, y, rotation?}] } -> Space[]
export const saveLayout = createAsyncThunk(
  "parking/saveLayout",
  async (args: { lotId: number; spaces: Array<Pick<Space, "id" | "label" | "x" | "y" | "rotation">> }, { dispatch }) => {
    await api.put(`/api/lots/${args.lotId}/layout`, { spaces: args.spaces });
    await dispatch(fetchSpaces(args.lotId));   // reload the server's truth
    return args.lotId;
  }
);
```

Handle its `rejected` case in `extraReducers` so a failed save surfaces (e.g. the 409 for an assigned spot):

```ts
.addCase(saveLayout.rejected, (state, action) => {
  state.error = action.error.message ?? "Could not save the layout";
})
```

> **`api.put` doesn't exist yet?** Your U0 `client.ts` may only have `get/post/patch/del`. Add a one-liner: `put: (p: string, b: unknown) => request(p, { method: "PUT", body: JSON.stringify(b) }),`.

**Why a single `PUT` and not many little calls?** Arranging is fiddly — you'll add, drag, and delete a dozen times before you're happy. Saving each micro-edit would be chatty and hard to undo. Instead the editor batches everything into one **replace** of the lot's layout: the server ends in exactly the state you see, no matter the path you took to get there. That's what makes `PUT` (not `PATCH`) the right verb. → [MDN: PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT).

### Step 2 — Add the "Arrange Spots" mode and an editable canvas (~25 min)

**2a. Add the edit action.** In `parkingSlice.ts`, extend the `EditAction` union with `"arrange"`:

```ts
type EditAction = "single" | "group" | "disable" | "enable" | "manual" | "update" | "arrange" | null;
```

Add an **Arrange Spots** button to the admin control panel in `ControlBoard.tsx`, next to the others:

```tsx
<button
  style={sideButtonStyle(editAction === 'arrange', !isControlPanelActive)}
  onClick={() => dispatch(setEditAction('arrange'))}
  disabled={!isControlPanelActive}
>
  Arrange Spots
</button>
```

**2b. Hold the working layout in local state.** While arranging, edits live in component state; only **Save Layout** commits them. Near the top of `ControlBoard`:

```tsx
const [draft, setDraft] = useState<Space[] | null>(null);   // the layout being edited
const [pickedId, setPickedId] = useState<number | null>(null);
const mapBoxRef = useRef<HTMLDivElement>(null);             // the map image wrapper we measure

// When Arrange turns on for a lot, seed the draft from the server's spaces.
useEffect(() => {
  if (editAction === 'arrange' && selectedLotId != null) {
    setDraft(spacesByLot[selectedLotId] ?? []);
  } else {
    setDraft(null);
    setPickedId(null);
  }
}, [editAction, selectedLotId, spacesByLot]);
```

**2c. Convert a mouse point to normalized coords.** This helper turns a click/drag anywhere on the map into an `{x, y}` fraction:

```tsx
const toNorm = (clientX: number, clientY: number) => {
  const rect = mapBoxRef.current!.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };  // clamp inside the map
};
```

**2d. Render the editable layout.** Add a `renderArrangeCanvas()` that draws the map image in a measured wrapper, places each draft spot with a CSS transform, and wires drag + click-to-add:

```tsx
const renderArrangeCanvas = () => {
  if (!draft || selectedLotId == null) return null;
  return (
    <div
      ref={mapBoxRef}
      onClick={(e) => {
        // Click on empty map (not on a spot) => add a new spot there.
        if (e.target !== mapBoxRef.current) return;
        const { x, y } = toNorm(e.clientX, e.clientY);
        const tempId = -Date.now();          // negative = "new, no server id yet"
        setDraft([...draft, { id: tempId, lot_id: selectedLotId, label: `S${draft.length + 1}`, status: 'available', x, y, rotation: 0 }]);
        setPickedId(tempId);
      }}
      style={{ position: 'relative', width: '100%', maxWidth: '640px', aspectRatio: '4 / 3', background: '#c9c9c9', cursor: 'crosshair' }}
    >
      {draft.map((s) => (
        <div
          key={s.id}
          onPointerDown={(e) => {
            e.stopPropagation();
            setPickedId(s.id);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (pickedId !== s.id || e.buttons === 0) return;
            const { x, y } = toNorm(e.clientX, e.clientY);
            setDraft((d) => d!.map((o) => (o.id === s.id ? { ...o, x, y } : o)));
          }}
          style={{
            position: 'absolute',
            left: `${(s.x ?? 0) * 100}%`,
            top: `${(s.y ?? 0) * 100}%`,
            width: '30px', height: '14px',
            transform: `translate(-50%, -50%) rotate(${s.rotation ?? 0}deg)`,
            background: s.status === 'assigned' ? '#e55' : s.status === 'disabled' ? '#aaa' : 'rgba(70,150,255,0.8)',
            border: pickedId === s.id ? '2px solid #c8a000' : '1px solid #1a3d7a',
            cursor: 'grab', boxSizing: 'border-box',
          }}
          title={s.label}
        />
      ))}
    </div>
  );
};
```

**Explanation of the tricky bits:**
- `setPointerCapture(e.pointerId)` — once you grab a spot, *that* element keeps receiving move events even if your cursor races off it. Without capture a fast drag "drops" the spot. → [MDN: setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).
- `e.buttons === 0` guard — only move while the button is actually held.
- `left/top` in **percentages** (`s.x * 100%`) + `translate(-50%, -50%)` centers the box on its stored fraction, so the same numbers place it identically at any image size.
- The tiny negative `id` (`-Date.now()`) marks a spot the server hasn't seen yet — Step 3's Save omits those `id`s so the backend creates them.

**2e. Show this canvas when arranging.** In the main canvas body, before the existing map/grid branches, add:

```tsx
{editAction === 'arrange' && selectedLotId != null
  ? renderArrangeCanvas()
  : /* ...the existing selectedLot map / grid rendering... */}
```

### Step 3 — Add rotate, delete, and Save Layout (~20 min)

Add a small toolbar (shown only while arranging) and the save handler. Put the toolbar inside the sidebar under the control panel:

```tsx
{editAction === 'arrange' && (
  <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <b>Arrange spots</b>
    <div>Click the map to add · drag to move.</div>
    <button disabled={pickedId == null} onClick={() =>
      setDraft((d) => d!.map((o) => o.id === pickedId ? { ...o, rotation: ((o.rotation ?? 0) + 15) % 360 } : o))
    }>Rotate 15°</button>
    <button disabled={pickedId == null} onClick={() => {
      setDraft((d) => d!.filter((o) => o.id !== pickedId));
      setPickedId(null);
    }}>Delete spot</button>
    <button
      style={{ background: '#7c7', border: '1px solid #000', borderRadius: '6px', padding: '6px' }}
      onClick={() => {
        if (selectedLotId == null || !draft) return;
        const spaces = draft.map((s) => ({
          id: s.id > 0 ? s.id : undefined,     // drop temp negative ids so the server creates them
          label: s.label,
          x: s.x ?? 0, y: s.y ?? 0, rotation: s.rotation ?? 0,
        }));
        dispatch(saveLayout({ lotId: selectedLotId, spaces }));
        dispatch(setEditAction(null));
      }}
    >Save Layout</button>
  </div>
)}
```

Add `saveLayout` to the `./store/parkingSlice` import list.

**Finally — draw saved layouts outside edit mode too.** So an admin (and, later, everyone) *sees* the arranged spots normally, update `renderParkingLot` to prefer a saved layout. Near its top:

```tsx
const spaces = selectedLotId != null ? (spacesByLot[selectedLotId] ?? []) : [];
const hasSavedLayout = spaces.some((s) => s.x != null && s.y != null);
if (hasSavedLayout) {
  // Read-only version of the arrange canvas: same absolute placement, no drag handlers.
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', aspectRatio: '4 / 3' }}>
      {spaces.map((s) => (
        <div key={s.id}
          onClick={() => isSelecting && dispatch(toggleSpaceSelection(s.id))}
          title={`${s.label} — ${s.status}`}
          style={{
            position: 'absolute', left: `${(s.x ?? 0) * 100}%`, top: `${(s.y ?? 0) * 100}%`,
            width: '30px', height: '14px', transform: `translate(-50%, -50%) rotate(${s.rotation ?? 0}deg)`,
            background: spaceColor(s), border: '1px solid #1a3d7a',
            cursor: isSelecting ? 'pointer' : 'default', boxSizing: 'border-box',
          }} />
      ))}
    </div>
  );
}
// ...otherwise fall through to the existing LOT_CONFIGS / map-crop / fan rendering (unchanged).
```

**UI mock (after this phase).** Admin in **Arrange Spots**: one spot picked (gold outline), toolbar on the left, crosshair cursor over the map.
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                       [Cancel][Done]│
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │   ┌───────────── lot map ──────────────┐  │
│ │Admin Ctrl │ │   │   ▭   ▭   ▭        ▭   ▭            │  │
│ │ Arrange ▣ │ │   │     ▧◀picked (drag me)   ▭          │  │  ▭ spot
│ └───────────┘ │   │   ▭        click empty map = add ↑  │  │  ▧ picked
│ ┌───────────┐ │   └────────────────────────────────────┘  │
│ │Arrange    │ │        (crosshair cursor over the map)     │
│ │ Rotate15° │ │                                            │
│ │ Delete    │ │   [Home][Lot A][Lot B]                     │
│ │ [Save Lay]│ │   Edit Mode ●——                            │
│ └───────────┘ │                                       LT   │
└───────────────┴──────────────────────────────────────────┘
```

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running through **B8** (seeded); `npm run dev`; log in as admin; pick a lot in the bottom nav.
2. **Steps:** **Edit Mode** on → **Arrange Spots** → click the map a few times to add spots → drag one across the map → pick it, **Rotate 15°** twice, then add another and **Delete** it → **Save Layout**. Then **refresh** the page. Finally, **resize the browser window**.
3. **Expected:**
   - Clicking empty map drops a new spot exactly where you clicked; dragging moves it and it stays on release.
   - Rotate visibly angles the picked spot; Delete removes it.
   - After **Save Layout**, edit mode closes and the spots render in place in normal view; after **refresh** they're unchanged (persisted).
   - After **resize**, every spot stays in the same spot *relative to the map* (normalized coords working).
   - Trying to delete an **assigned** spot and saving surfaces a red error (server `409`) — nothing is lost.
   - A lot you never arranged still draws via the old config tables (no regression).

**☁️ Cloud check (optional):** needs backend **B8** deployed. `./release.sh all`, arrange a lot on the live site, **refresh** — the layout persists in RDS. Then open the same lot in a second browser/incognito window: the arrangement shows there too (it's server data now, not your browser's).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U8: drag-and-drop spot layout editor + saved layouts (PUT /api/lots/:id/layout)"
git push -u origin cr/u8-arrange-spots
```

Open a PR with **base = `cr/u7-map-upload`**. Paste your "Prove it works" output as testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). Record the PR in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## 🧯 If something breaks

- **A dragged spot "sticks" to the cursor after you let go** — you're missing `setPointerCapture` or the `e.buttons === 0` guard; also make sure you don't have a stray `onClick`-to-add firing on the spot itself (that's why the spot's `onPointerDown` calls `e.stopPropagation()`).
- **New spots land in the wrong place** — you're probably measuring the wrong element. `mapBoxRef` must be on the exact box whose size matches the coordinate space you draw into; `getBoundingClientRect()` reads *that* box.
- **Spots drift when you zoom/resize** — you saved raw pixels somewhere instead of the `0..1` fraction. Every stored `x/y` must be normalized in `toNorm`, and every render must multiply by the rendered size (percentages do this for free).
- **Save returns 409** — you tried to delete/replace a spot that's currently `assigned`. Re-assign or un-assign it first (U6), or keep it in the layout.
- **`api.put is not a function`** — add the `put` method to `client.ts` (see Step 1's note).
- **Everything vanished after Save** — your Save mapped `id: 0`/kept the negative temp ids; confirm you send `id: undefined` for new spots and real ids for existing ones.

---

## 📝 Recap — what you built and learned

- You turned spot **positions** from hard-coded source into **server data an admin authors** in the browser.
- You learned **normalized coordinates** — the reason a saved layout survives zoom, resize, and different screens.
- You implemented **pointer-event dragging** with pointer capture, and a **click-to-add / rotate / delete** editor.
- You reused the **optimistic-then-refetch** and **idempotent replace (`PUT`)** patterns to persist a whole layout in one shot, while keeping the old config-table rendering as a safe fallback.

---

## 📚 References

- [MDN — Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) and [setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) — mouse/touch dragging done right.
- [MDN — getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) — measuring the map to normalize a point.
- [MDN — CSS transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform) — placing and rotating each spot.
- [MDN — HTTP PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) — why a full-replace save is idempotent.
- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) — the `saveLayout` thunk.
- Source of truth for this lesson: [ui guide → CR U8](../ui-development-guide.md#cr-u8--place--arrange-parking-spots-drag-and-drop-layout-editor).

---

## ➡️ Next lesson

You can now arrange spots on any lot — but every lot still comes from the seed. Next you'll let an admin **create a brand-new lot from the UI**, then arrange its spots with what you just built: **[Lesson U9 — Add a new parking lot](U9-add-a-parking-lot.md)**.
