# Lesson U8 — Place & arrange parking spots (drag-and-drop layout editor)

> **Track:** Frontend · **Lesson 9 of 10**
> **⏱ Time:** ~75 min · **🎚 Difficulty:** hard (your first drag-and-drop UI and the first time the app *authors* map data instead of just displaying it)
> **🧩 Prerequisites:** you've done [Lesson U7 — Update the school map image](U7-update-school-map.md); the backend's layout endpoint (`PUT /api/lots/:id/layout`, backend **B8**) running.
> **🌿 CR branch:** `cr/u8-arrange-spots` (off `cr/u7-map-upload`) · **📄 Source CR:** [ui guide → CR U8](../ui-development-guide.md#cr-u8--place--arrange-parking-spots-drag-and-drop-layout-editor) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Today, **where** each parking spot sits on a lot's map is frozen in code — three hand-tuned tables at the top of `ControlBoard.tsx` (`LOT_CONFIGS`, `LOT_MAP_CONFIGS`, `LOT_FAN_CONFIGS`) that only a developer can edit, one pixel at a time. By the end of this hour an **admin** can, in the browser, **press ➕ Add Spot, drag it to the right place, resize it to match the painted space, rotate it, rename it, delete it, and press Save Layout** — and the layout is stored on the server so it survives a refresh and shows for everyone.

Concretely, you will have:

- A new `rotation` field on the `Space` type (the `x`, `y`, `w`, `h` fields already arrived in [U3](U3-show-real-lots-and-spaces.md) for *rendering* spots; here you make them *editable* and add `rotation`) — a spot's **position *and size*** stored as **normalized** fractions (`0..1` of the map image), so a spot stays correct *and keeps its shape* at any zoom or screen size.
- An **"Arrange Spots"** edit action that turns the selected lot's map into an editable canvas: a **➕ Add Spot** button (drops a spot at the map's center), drag-to-move, resize controls, rotate CW/CCW by an adjustable angle, an editable **Label**, and a Delete for the picked spot.
- **Pan + wheel-zoom on the lot map** while arranging (the same `translate`-offset model the campus/Home view already uses), so you can work up close on a large map.
- A **Save Layout** button that `PUT`s the whole lot's spots to `/api/lots/:id/layout`, plus the optimistic-update-then-refetch pattern from U4.
- A rendering path that draws a lot **from its saved layout** when it has one, and falls back to the old hard-coded config tables for lots that don't.

**✅ Done when (your deliverable checklist):**
- [ ] In Edit Mode, **Arrange Spots** makes the current lot's map editable; **➕ Add Spot** drops a new spot at the center of the map (clicking the map does *not* add one).
- [ ] You can **drag** any spot to a new position and it stays put when you release the mouse — even on a fast drag that leaves the box.
- [ ] You can **pan** the map by dragging empty space and **wheel-zoom** it, anchored under the cursor.
- [ ] You can select a spot and **resize** it (bigger/smaller, wider/narrower, taller/shorter), **rotate** it CW/CCW, **rename** it, and **delete** it — but Delete is refused for a spot that is currently `assigned`.
- [ ] **Save Layout** persists the arrangement; after a **refresh** the spots are exactly where — and the size — you left them.
- [ ] Zooming/resizing the window does **not** move *or reshape* the spots relative to the map (position and size are normalized, not raw pixels).
- [ ] A lot with **no** saved layout still renders via the old config tables (no regression to Lots you haven't arranged yet).
- [ ] Work committed on `cr/u8-arrange-spots` and pushed, PR base = `cr/u7-map-upload`.

---

## 🤔 Why this lesson matters

Up to now the app has been a **viewer**: it fetches data the server owns (lots, spaces, statuses) and paints it. The spot *positions*, though, were never data — they were source code. That's why adding or moving a spot meant a developer editing `LOT_MAP_CONFIGS` and redeploying, and why several lots are stuck as "map-only" (a photo with no clickable grid) in the prototype. This lesson flips positions from **code** into **data an admin can author**, which is the difference between a demo and a tool the school can actually run.

Two ideas do the heavy lifting:

1. **Normalized position *and size*.** We never store "spot is at pixel (417, 232), 26×12px" — that's meaningless the moment the image is scaled, zoomed, or shown on a different screen. We store four fractions: `x = 0.63, y = 0.41` means "63% across, 41% down the map image," and `w = 0.05, h = 0.03` means "5% of the map wide, 3% tall." To draw a spot we multiply by the image's *rendered* size; to save a drag we divide the drop point by that same size. The numbers are stable forever. **The payoff: you never persist the map's zoom level.** Because `x/y/w/h` are all fractions *of the map*, a spot lands in the right place and keeps its shape whether the map is shown at 40% or 300% — arrange-time zoom is purely a placement convenience, not something to save. (A first cut stored `x/y` as fractions but hard-coded the size at `26×12px`; the spots then refused to scale with the map — that's why size is normalized too.)
2. **Author-then-persist.** Dragging updates local React state instantly (so it feels direct), but nothing is real until **Save Layout** sends the whole set to the server and we refetch the truth back — the exact optimistic pattern you built in [U4](U4-enable-disable-saves.md).

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Pointer events & dragging** | `onPointerDown/Move/Up` is the modern mouse-and-touch way to drag. **Capture the pointer on the map *container*, not the tiny spot** — tracking a `draggingRef` there, so a fast drag that leaves the 26px box isn't dropped. | [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · [MDN: setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) |
| **`getBoundingClientRect()`** | Reads an element's on-screen size/position so you can convert a mouse point into a fraction of the image. | [MDN: getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) |
| **Normalized position & size** | Storing `x/y/w/h` as `0..1` of the map instead of raw pixels, so a spot survives resize/zoom *and* keeps its shape. | [Game/graphics term; see "normalized device coordinates"](https://en.wikipedia.org/wiki/Normalized_device_coordinates) |
| **CSS transforms (`translate`, `rotate`)** | Positioning/rotating a box without changing layout flow — how each spot is placed, and how the whole map **pans**: the map+spots ride in one `translate(offset)` layer (`transform-origin:0 0`), never a scroll container. | [MDN: transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform) |
| **Cursor-anchored wheel-zoom** | Zoom so the point under the cursor stays fixed: read zoom/offset from a ref, compute `ratio = next/prev`, shift the offset by `cursor*(1-ratio)`. Same mechanism as the campus view. Attach the listener with `{ passive:false }` (React `onWheel` is passive). | [MDN: WheelEvent](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent) |
| **Optimistic UI update** | Update the screen immediately, then confirm with the server and roll back on failure (reused from U4). | [Redux Toolkit: async logic](https://redux-toolkit.js.org/usage/usage-guide#async-requests-with-createasyncthunk) |
| **Idempotent `PUT` (replace)** | Sending the *whole* desired layout so the server ends in a known state regardless of what was there before. | [MDN: PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) |

---

## ✅ Before you start

**Time budget for the hour+:** setup & branch (5 min) → Step 1, types + thunk (15) → Step 2, editable canvas + drag (25) → Step 3, add/rotate/delete + Save (20) → test & commit (15).

You need **U7** merged (or on your machine) and backend **B8** running — the endpoint that persists a lot's layout. This CR **depends on** both.

> **📸 What's already in the prototype:** `ControlBoard.tsx` positions spots three ways today — a plain grid (`LOT_CONFIGS`), a rotated map-crop overlay (`LOT_MAP_CONFIGS`), and a curved "fan" (`LOT_FAN_CONFIGS`), all hard-coded, and it has a `MAP_ONLY_LOTS` set for lots shown as a photo with no grid. **Keep all of that as the fallback.** This lesson adds a *new, higher-priority* path: if the server sends spots that carry `x`/`y`, we draw from those instead. Nothing you built in U3–U7 is thrown away.

**The backend contract this lesson calls (backend B8):**

- `GET /api/lots/:id/spaces` now returns each space with optional `x`, `y`, `w`, `h` (floats `0..1`) and `rotation` (degrees). Legacy spaces have them `null`. (`w`/`h` map to the backend's `pos_w`/`pos_h` columns, added alongside `pos_x`/`pos_y`/`rotation`.)
- `PUT /api/lots/:id/layout` — body `{ spaces: [{ id?: number, label: string, x: number, y: number, w: number, h: number, rotation?: number }] }`. The server **replaces** the lot's spot set in one transaction: entries with an `id` are updated, entries without one are created, and existing spaces missing from the list are deleted. It refuses to delete a space that is currently `assigned` (returns `409`), so you can't strand a student's spot. Returns the updated `Space[]`.

**Make your branch.** U8 continues from U7:

```bash
git checkout cr/u7-map-upload
git checkout -b cr/u8-arrange-spots
```

---

## 🛠 Build it, step by step

### Step 1 — Add the `rotation` field + a save-layout thunk to `parkingSlice.ts` (~15 min)

The `Space` type already carries `x`/`y`/`w`/`h` from [U3](U3-show-real-lots-and-spaces.md) (that's what draws a spot at its saved position). The only *new* field U8 needs is `rotation`; the full shape, for reference, is:

```ts
export interface Space {
  id: number;
  lot_id: number;
  label: string;
  status: "available" | "disabled" | "assigned";
  assigned_user_id: number | null;      // who holds it (from U3)
  assigned_user_name: string | null;    // who holds it (from U3) — shown in the hover tooltip
  x: number | null;          // 0..1 across the map image (from U3; null = legacy, use config fallback)
  y: number | null;          // 0..1 down the map image (from U3)
  w: number | null;          // 0..1 of map width  (from U3; spot size — default ~0.05)
  h: number | null;          // 0..1 of map height (from U3; spot size — default ~0.03)
  rotation: number | null;   // degrees — NEW in U8
}
```

Now add the thunk that saves a whole lot's layout. Put it next to `updateSpaces`:

```ts
// PUT /api/lots/:id/layout  body { spaces: [{id?, label, x, y, w, h, rotation?}] } -> Space[]
export const saveLayout = createAsyncThunk(
  "parking/saveLayout",
  async (args: { lotId: number; spaces: Array<Pick<Space, "id" | "label" | "x" | "y" | "w" | "h" | "rotation">> }, { dispatch }) => {
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

**2b. Hold the working layout — and the map's pan/zoom — in local state.** While arranging, edits live in component state; only **Save Layout** commits them. Near the top of `ControlBoard`:

```tsx
const DEFAULT_SPOT_W = 0.05, DEFAULT_SPOT_H = 0.03;   // a new spot's size, as fractions of the map

const [draft, setDraft] = useState<Space[] | null>(null);   // the layout being edited
const [pickedId, setPickedId] = useState<number | null>(null);
const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);  // hover tooltip

const mapBoxRef = useRef<HTMLDivElement>(null);   // the translate layer we measure
const draggingRef = useRef<number | null>(null);  // id of the spot being dragged (null = pan the map)
const panRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, moved: false });

const selectedLot = lots.find((l) => l.id === selectedLotId);
const isSpaceAssigned = (id: number) =>
  (spacesByLot[selectedLotId ?? -1]?.find((x) => x.id === id)?.status) === 'assigned';

// When Arrange turns on for a lot, seed the draft from the server's spaces.
useEffect(() => {
  if (editAction === 'arrange' && selectedLotId != null) setDraft(spacesByLot[selectedLotId] ?? []);
  else { setDraft(null); setPickedId(null); }
}, [editAction, selectedLotId, spacesByLot]);
```

> **Pan (`lotOffset`) and wheel-zoom (`lotZoom`) are the *same* state and handlers you built for the campus map in [U3](U3-show-real-lots-and-spaces.md)** — reuse them for the lot view; don't invent a new mechanism. Reset them to zero **in the lot-nav click handler** when you switch lots, *not* in a `useEffect` (eslint's `react-hooks/set-state-in-effect` forbids setting state from an effect).

**2c. Convert a mouse point to normalized coords.** This helper turns a drag anywhere on the map into an `{x, y}` fraction. It measures `mapBoxRef` — the `translate`/`scale` layer — so the current pan and zoom are already baked into the reading:

```tsx
const toNorm = (clientX: number, clientY: number) => {
  const rect = mapBoxRef.current!.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };  // clamp inside the map
};
```

**2d. Render the editable layout.** First, one helper adds a spot — used by the **➕ Add Spot** button *only* (dropping it at the map's center), never by clicking the map:

```tsx
const addSpotToDraft = (x: number, y: number) => {
  if (!draft || selectedLotId == null) return;
  const tempId = -Date.now();                     // negative = "new, no server id yet"
  const n = draft.length + 1;
  const label = selectedLot?.number != null ? `${selectedLot.number}-${n}` : `S${n}`;  // lot-number prefix (U9)
  setDraft([...draft, { id: tempId, lot_id: selectedLotId, label, status: 'available',
    x, y, w: DEFAULT_SPOT_W, h: DEFAULT_SPOT_H, rotation: 0 }]);
  setPickedId(tempId);
};
```

Now `renderArrangeCanvas()` draws the map inside one pannable/zoomable `translate` layer and places each draft spot on it. Note the **container** owns the pointer handlers — a spot only records `draggingRef`; the container decides "move a spot" vs "pan the map":

```tsx
const renderArrangeCanvas = () => {
  if (!draft || selectedLotId == null) return null;
  return (
    <div
      style={{ overflow: 'hidden', position: 'relative', width: '100%', maxWidth: '640px', aspectRatio: '4 / 3', background: '#c9c9c9' }}
      onPointerDown={(e) => {
        if (draggingRef.current != null) return;          // a spot grabbed the pointer first
        panRef.current = { startX: e.clientX, startY: e.clientY, ox: lotOffset.x, oy: lotOffset.y, moved: false };
      }}
      onPointerMove={(e) => {
        if (draggingRef.current != null) {                // dragging a spot
          const { x, y } = toNorm(e.clientX, e.clientY);
          const id = draggingRef.current;
          setDraft((d) => d!.map((o) => (o.id === id ? { ...o, x, y } : o)));
          return;
        }
        if (e.buttons === 0) return;                      // panning the empty map
        const dx = e.clientX - panRef.current.startX, dy = e.clientY - panRef.current.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panRef.current.moved = true;
        setLotOffset({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
      }}
      onPointerUp={() => { draggingRef.current = null; }}
    >
      <div ref={mapBoxRef} style={{ position: 'absolute', inset: 0,
        transform: `translate(${lotOffset.x}px, ${lotOffset.y}px) scale(${lotZoom})`, transformOrigin: '0 0' }}>
        {selectedLot?.map_image_url &&
          <img src={selectedLot.map_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />}
        {draft.map((s) => (
          <div key={s.id}
            onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = s.id; setPickedId(s.id); }}
            {...draftHoverProps(s)}
            style={{
              position: 'absolute',
              left: `${(s.x ?? 0.5) * 100}%`, top: `${(s.y ?? 0.5) * 100}%`,
              width: `${(s.w ?? DEFAULT_SPOT_W) * 100}%`, height: `${(s.h ?? DEFAULT_SPOT_H) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${s.rotation ?? 0}deg)`,
              background: isSpaceAssigned(s.id) ? 'rgba(122,167,255,.85)' : 'rgba(255,235,59,.8)',
              border: pickedId === s.id ? '2px solid #c8a000' : '1px solid #1a3d7a',
              cursor: 'grab', boxSizing: 'border-box',
            }} />
        ))}
      </div>
    </div>
  );
};
```

**Explanation of the tricky bits:**
- **Capture on the container, not the spot.** The spot's `onPointerDown` only records `draggingRef.current = s.id` and stops propagation; the *container's* `onPointerMove` then moves that spot. An earlier version called `setPointerCapture` on the 26px spot itself — a fast drag that left the box dropped the spot ("not moveable"). Tracking a `draggingRef` on the big container fixes it. → [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).
- **Dragging empty map = pan.** When no spot grabbed the pointer, the same handlers pan the whole `translate` layer; a move past ~4px sets `panRef.moved` so the release isn't mistaken for a spot click. The layer is one `translate(...) scale(...)` box (`transform-origin:0 0`) inside an `overflow:hidden` container — never a scroll container (see 🧯).
- **Size is normalized too.** `width/height` are **percentages** (`s.w * 100%`, `s.h * 100%`) of the map box, and `left/top` + `translate(-50%,-50%)` center the box on its stored fraction — so both position *and shape* are identical at any image size.
- **Colors match the lot-view legend:** assigned = blue, available/new = yellow (`isSpaceAssigned`).
- The negative `id` (`-Date.now()`) marks a spot the server hasn't seen yet — Step 3's Save omits those `id`s so the backend creates them.

**2e. Show this canvas when arranging.** In the main canvas body, before the existing map/grid branches, add:

```tsx
{editAction === 'arrange' && selectedLotId != null
  ? renderArrangeCanvas()
  : /* ...the existing selectedLot map / grid rendering... */}
```

### Step 3 — Add the arrange toolbar: add · label · resize · rotate · delete · save (~25 min)

First, a few small helpers that edit the **picked** spot. Put them near `addSpotToDraft`:

```tsx
const [angle, setAngle] = useState(15);   // degrees per rotate click

const patchPicked = (patch: Partial<Space>) => setDraft((d) => d!.map((o) => (o.id === pickedId ? { ...o, ...patch } : o)));
const clampSize = (v: number) => Math.min(0.6, Math.max(0.01, v));   // keep a spot a sane fraction of the map
const rotatePicked = (dir: 1 | -1) =>
  setDraft((d) => d!.map((o) => o.id === pickedId ? { ...o, rotation: ((((o.rotation ?? 0) + dir * angle) % 360) + 360) % 360 } : o));

// hover tooltip: existing spot -> status/assignee; unsaved spot -> its size as a % of the map
const draftSummary = (s: Space) =>
  s.id > 0
    ? `Spot ${s.label} — ${isSpaceAssigned(s.id) ? `Assigned to ${s.assigned_user_name ?? 'a student'}` : s.status === 'disabled' ? 'Disabled' : 'Available'}`
    : `Spot ${s.label} — new · ${Math.round((s.w ?? 0) * 100)}%×${Math.round((s.h ?? 0) * 100)}% of map`;
const draftHoverProps = (s: Space) => ({
  onMouseEnter: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text: draftSummary(s) }),
  onMouseMove:  (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text: draftSummary(s) }),
  onMouseLeave: () => setTip(null),
});
```

Resize needs the spot's *current* `w`/`h` to compute the next one, so write `scale` (uniform) and `adjust` (per-axis) as their own `setDraft` maps rather than routing through `patchPicked`:

```tsx
const scale  = (f: number)              => setDraft((d) => d!.map((o) => o.id === pickedId ? { ...o, w: clampSize((o.w ?? DEFAULT_SPOT_W) * f), h: clampSize((o.h ?? DEFAULT_SPOT_H) * f) } : o));
const adjust = (dw: number, dh: number) => setDraft((d) => d!.map((o) => o.id === pickedId ? { ...o, w: clampSize((o.w ?? DEFAULT_SPOT_W) + dw), h: clampSize((o.h ?? DEFAULT_SPOT_H) + dh) } : o));
```

Now the toolbar (shown only while arranging). Put it in the sidebar under the control panel:

```tsx
{editAction === 'arrange' && (
  <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <b>Arrange spots</b>
    <div>Press <b>➕ Add Spot</b> · drag a spot to move it · drag the empty map to pan · wheel to zoom.</div>
    <button onClick={() => addSpotToDraft(0.5, 0.5)}>➕ Add Spot</button>

    {pickedId != null && (() => {
      const picked = draft!.find((o) => o.id === pickedId)!;
      const lockedDelete = isSpaceAssigned(picked.id);
      return (
        <>
          <label>Label
            <input value={picked.label} onChange={(e) => patchPicked({ label: e.target.value })} style={{ width: '100%', marginTop: '2px' }} />
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => scale(1.15)}>Bigger</button>
            <button onClick={() => scale(0.87)}>Smaller</button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => adjust(0.006, 0)}>Wider</button>
            <button onClick={() => adjust(-0.006, 0)}>Narrower</button>
            <button onClick={() => adjust(0, 0.006)}>Taller</button>
            <button onClick={() => adjust(0, -0.006)}>Shorter</button>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={() => rotatePicked(-1)}>↺ CCW</button>
            <button onClick={() => rotatePicked(1)}>CW ↻</button>
            <label>Angle <input type="number" min={1} max={180} value={angle}
              onChange={(e) => setAngle(Number(e.target.value) || 15)} style={{ width: '46px' }} /></label>
          </div>
          <button disabled={lockedDelete}
            onClick={() => { setDraft((d) => d!.filter((o) => o.id !== pickedId)); setPickedId(null); }}>
            Delete spot
          </button>
          {lockedDelete && <div style={{ color: '#b00' }}>Can't delete an assigned spot — unassign it first (U6).</div>}
        </>
      );
    })()}

    <button
      style={{ background: '#7c7', border: '1px solid #000', borderRadius: '6px', padding: '6px' }}
      onClick={() => {
        if (selectedLotId == null || !draft) return;
        const spaces = draft.map((s) => ({
          id: s.id > 0 ? s.id : undefined,     // drop temp negative ids so the server creates them
          label: s.label,
          x: s.x ?? 0.5, y: s.y ?? 0.5,
          w: s.w ?? DEFAULT_SPOT_W, h: s.h ?? DEFAULT_SPOT_H,
          rotation: s.rotation ?? 0,
        }));
        dispatch(saveLayout({ lotId: selectedLotId, spaces }));
        dispatch(setEditAction(null));
      }}
    >Save Layout</button>
  </div>
)}
```

Add `saveLayout` to the `./store/parkingSlice` import list.

**Explanation of the new controls:**
- **➕ Add Spot is the *only* way to add** — it drops a spot at the map's center (`0.5, 0.5`) via `addSpotToDraft`. There is deliberately **no click-on-map handler** (see 🧯): once the map is draggable, stray clicks would litter it with spots.
- **Resize because the drawn box rarely matches the painted space.** Uniform **Bigger/Smaller** (`×1.15`/`×0.87`) plus per-axis **Wider/Narrower/Taller/Shorter** (`±0.006`), all clamped to `0.01..0.6`. Since `w/h` are fractions, the fit holds at any display size — you never rescale the whole map to fit a fixed spot.
- **Rotate both ways by an adjustable angle.** `↺ CCW` / `CW ↻` apply `±angle`, normalized to `0..359` so CCW never goes negative; the **Angle** field sets the degrees per click (default 15).
- **Delete is gated.** If the picked spot is a saved space that's currently `assigned`, Delete is disabled with a note — the server would reject removing it (`409`) anyway.

Finally, render the floating hover tooltip once, near the end of the component's returned JSX (outside the `translate` layer so it isn't clipped or panned):

```tsx
{tip && (
  <div style={{ position: 'fixed', left: tip.x + 14, top: tip.y + 14, zIndex: 200,
    background: '#111', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', pointerEvents: 'none' }}>
    {tip.text}
  </div>
)}
```

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
          {...hoverProps(s)}                                   // floating tooltip from U3 (replaces native title)
          style={{
            position: 'absolute', left: `${(s.x ?? 0) * 100}%`, top: `${(s.y ?? 0) * 100}%`,
            width: `${(s.w ?? DEFAULT_SPOT_W) * 100}%`, height: `${(s.h ?? DEFAULT_SPOT_H) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${s.rotation ?? 0}deg)`,
            background: spaceColor(s), border: '1px solid #1a3d7a',
            cursor: isSelecting ? 'pointer' : 'default', boxSizing: 'border-box',
          }} />
      ))}
    </div>
  );
}
// ...otherwise fall through to the existing LOT_CONFIGS / map-crop / fan rendering (unchanged).
```

**UI mock (after this phase).** Admin in **Arrange Spots**: one spot picked (gold outline), the full toolbar on the left, empty-map drag pans.
```
┌──────────────────────────────────────────────────────────┐
│ LTRide                                       [Cancel][Done]│
├───────────────┬──────────────────────────────────────────┤
│ ┌───────────┐ │   ┌───────────── lot map ──────────────┐  │
│ │Admin Ctrl │ │   │   ▭   ▭   ▭        ▭   ▭            │  │
│ │ Arrange ▣ │ │   │     ▧◀picked (drag me)   ▭          │  │  ▭ available/new
│ └───────────┘ │   │   ▭   drag empty map = pan, wheel=zoom│  │  ▧ picked
│ ┌───────────┐ │   └────────────────────────────────────┘  │
│ │➕ Add Spot │ │        (spots stay put while you pan)      │
│ │Label [__] │ │                                            │
│ │Bigger/Smlr│ │   [Home][Lot A][Lot B]                     │
│ │W/N/T/S    │ │   Edit Mode ●——                            │
│ │↺CCW  CW↻  │ │                                       LT   │
│ │Angle [15] │ │                                            │
│ │Delete     │ │                                            │
│ │[Save Lay] │ │                                            │
│ └───────────┘ │                                            │
└───────────────┴──────────────────────────────────────────┘
```

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running through **B8** (seeded); `npm run dev`; log in as admin; pick a lot in the bottom nav.
2. **Steps:** **Edit Mode** on → **Arrange Spots** → press **➕ Add Spot** a few times → drag one across the map (start the drag, then move the cursor *outside* the little box before releasing) → pick it, rename its **Label**, click **Bigger**/**Wider**/**Taller** a couple of times, then **↺ CCW** and **CW ↻** with a custom **Angle** → drag the *empty* map to pan, and scroll the wheel to zoom (cursor-anchored) → add one more spot and **Delete** it → **Save Layout**. Then **refresh** the page. Finally, **resize the browser window**. Also click *(and don't drag)* directly on the empty map — nothing should be added.
3. **Expected:**
   - **➕ Add Spot** is the only thing that adds a spot (center of the map); clicking the empty map does nothing.
   - Dragging a spot moves it and it **stays attached to the cursor even past the box's edges** — no "drops the spot" glitch.
   - Resize buttons visibly grow/shrink/stretch the picked spot; rotate turns it both directions by the chosen angle (CCW wraps to `359°`, not negative).
   - Renaming the Label field updates what's shown in the toolbar and (after save) the spot's identity.
   - Dragging the empty map pans smoothly in any direction (no scrollbars); the wheel zooms anchored under the cursor; the left sidebar keeps its width the whole time.
   - Hovering a spot shows the floating tooltip — status/assignee for a saved spot, `w%×h%` for an unsaved one.
   - Delete removes the picked spot; Delete is **disabled** (with a note) for a spot that's currently `assigned`.
   - After **Save Layout**, edit mode closes and the spots render in place in normal view; after **refresh** they're unchanged — position **and size** (persisted).
   - After **resize**, every spot stays in the same spot and shape *relative to the map* (normalized coords + size working).
   - Deleting an **assigned** spot is blocked client-side (the button is disabled with a note); if a spot gets assigned by another admin action *while* you're arranging, Save Layout surfaces the server's `409` instead of silently orphaning it.
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

- **A dragged spot "drops" the moment the cursor leaves the little box** — you bound `pointermove`/`pointerup` (or `setPointerCapture`) to the tiny spot instead of the map **container**. Capture on the container, key the move handler off `draggingRef`, and have the spot's `onPointerDown` only set that ref + `stopPropagation()` (Step 2d).
- **Clicking the empty map adds a spot** — you kept a click-to-add handler on the map. Per U-5/U-13, **➕ Add Spot** is the *only* way to add a spot now; delete any `onClick` on the map container that creates a spot.
- **Dragging a spot also pans the map** (or vice versa) — check the order in the container's pointer handlers: a spot's `onPointerDown` must set `draggingRef` and `stopPropagation()` *before* the container's own `onPointerDown` starts a pan; the container should only start panning when `draggingRef.current == null`.
- **New spots land in the wrong place** — you're probably measuring the wrong element. `mapBoxRef` must be on the exact `translate`/`scale` layer whose size matches the coordinate space you draw into; `getBoundingClientRect()` reads *that* box, so the current pan/zoom is automatically accounted for.
- **Spots drift or change shape when you zoom/resize** — you saved raw pixels somewhere instead of the `0..1` fraction, for either position **or size**. Every stored `x/y/w/h` must be normalized in `toNorm`/the resize helpers, and every render must use percentages (they do the scaling for free).
- **The lot map won't pan sideways, or shows a lone scrollbar** — you used an `overflow:auto` scroll container instead of the `translate`-offset layer; switch to `overflow:hidden` + `transform: translate(...) scale(...)` (same model as U3's Home/lot-view pan).
- **Rotate CCW goes negative / shows `-15°`** — you didn't wrap the result; normalize with `((r + delta) % 360 + 360) % 360`.
- **Resize buttons do nothing** — you routed them through `patchPicked` without reading the spot's *current* `w`/`h` first; write `scale`/`adjust` as their own `setDraft` maps (Step 3) so each click computes from the latest size.
- **Delete is always disabled, even for a brand-new spot** — check `isSpaceAssigned`: it should look up the spot's *saved* status in `spacesByLot`, not the draft (a new, unsaved spot's `id` is a negative temp id that won't match any saved space, so it's never "assigned").
- **Zooming the map shrinks the left sidebar** — same fix as U3: `flexShrink: 0` on the sidebar `aside`, `minWidth: 0` on `main`. Arrange mode zooms too, so this bites here if you skipped it in U3.
- **Save returns 409** — you tried to delete/replace a spot that's currently `assigned`. Re-assign or un-assign it first (U6), or keep it in the layout.
- **`api.put is not a function`** — add the `put` method to `client.ts` (see Step 1's note).
- **Everything vanished after Save** — your Save mapped `id: 0`/kept the negative temp ids; confirm you send `id: undefined` for new spots and real ids for existing ones.

---

## 📝 Recap — what you built and learned

- You turned spot **position *and size*** from hard-coded source into **server data an admin authors** in the browser — `x/y/w/h` as fractions of the map, so nothing about display size or zoom needs to be persisted.
- You built a robust drag by capturing the pointer on the map **container** (keyed by a `draggingRef`), not the tiny spot box — and made **➕ Add Spot** the one deliberate way to create a spot, instead of an error-prone click-on-map.
- You gave the arrange editor **resize** (uniform + per-axis), **rotate both directions** by an adjustable angle, an editable **Label**, and a **Delete** that's gated against removing an `assigned` spot.
- You extended the lot view's **pan + cursor-anchored wheel-zoom** (from U3) to work inside the arrange editor too, and reused its floating tooltip for both saved and in-progress spots.
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
