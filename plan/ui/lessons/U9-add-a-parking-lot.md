# Lesson U9 — Add (and remove) a parking lot from the admin UI

> **Track:** Frontend · **Lesson 10 of 10**
> **⏱ Time:** ~65 min · **🎚 Difficulty:** moderate (a create-form + modal you've done pieces of before — the new ideas are *creating* a resource, then chaining the U7/U8 tools onto it, and *deleting* one safely)
> **🧩 Prerequisites:** you've done [Lesson U8 — Place & arrange parking spots](U8-place-and-arrange-spots.md); the backend's create-lot endpoint (`POST /api/lots`, backend **B9**) running.
> **🌿 CR branch:** `cr/u9-add-lot` (off `cr/u8-arrange-spots`) · **📄 Source CR:** [ui guide → CR U9](../ui-development-guide.md#cr-u9--add-a-new-parking-lot-from-the-admin-ui) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Today the lot list is frozen: the bottom nav is a hard-coded loop of `Home + Lot 1..17`, and there is no way to add lot 18 without editing code. By the end of this hour an **admin** can click **➕ Add Lot**, type a name, an optional **lot number**, and an optional capacity, and a real new lot is created on the server and appears in the nav immediately — ready for the admin to upload its map ([U7](U7-update-school-map.md)) and arrange its spots ([U8](U8-place-and-arrange-spots.md)). They can also **🗑 Remove Lot** — but only when none of its spaces are assigned, so you never orphan a student's spot.

Concretely, you will have:

- A `createLot` thunk that `POST`s to `/api/lots` and refreshes the lot list so the new lot shows up.
- An **➕ Add Lot** button on the Admin Control Board and a small **Create Lot** modal (name required; **lot number** and capacity optional) that validates input and shows server errors.
- The **lot number** convention: the number the admin sets prefixes every spot label in that lot (`7-1, 7-2, …`), so a spot's label tells you which lot it's in. The number is unique across lots.
- Auto-selection of the freshly created lot, so the admin lands right on it to keep building (upload map → arrange spots).
- A gated **🗑 Remove Lot** button + a `deleteLot` thunk (`DELETE /api/lots/:id`) that is disabled (with a note) when any space is assigned, confirms before deleting, and resets the view to Home on success.

**✅ Done when (your deliverable checklist):**
- [ ] An admin sees **➕ Add Lot** and **🗑 Remove Lot** controls; a student does not.
- [ ] Submitting the modal with a name creates a lot; it appears in the bottom lot-nav **without a refresh**.
- [ ] Setting a **lot number** makes new spots in that lot label as `<number>-<n>`; a **duplicate** number is rejected by the server with a red error.
- [ ] After creating, that new lot is **selected**, so you can immediately **Update School Map** (U7) and **Arrange Spots** (U8) on it.
- [ ] Submitting a blank name is blocked; a duplicate name (or other server rejection) shows a **red error**, no crash.
- [ ] **🗑 Remove Lot** is disabled (with an explanatory note) when a space in the lot is assigned; removing an all-unassigned lot works, and after it the view returns to Home.
- [ ] After a **refresh**, a created lot is still there, and a removed lot is still gone (it's the database, not local state).
- [ ] Work committed on `cr/u9-add-lot` and pushed, PR base = `cr/u8-arrange-spots`.

---

## 🤔 Why this lesson matters

Every previous CR either *read* server data or *edited* rows that the seed already created. This is the first time the UI **creates a brand-new top-level resource** — a `POST` that makes a row that didn't exist. That's a small but important shift: the app stops being limited to the 17 lots someone typed into a seed file and becomes something the school can grow on its own.

It's also the capstone that ties U7 and U8 together into a real workflow. On its own, "add a lot" would give you an empty, mapless lot — not very useful. But you already built the two tools that finish the job: **U7** puts a photo behind it and **U8** places its spots. So this lesson deliberately ends by **selecting the new lot and pointing the admin at those tools** — three CRs combining into one coherent "stand up a new lot from scratch" flow. Recognizing when a new feature should *hand off* to features you already have (instead of re-implementing them) is a habit worth building.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`POST` to create a resource** | The HTTP verb that asks the server to make a new thing and return it (usually `201 Created`). | [MDN: POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) |
| **Controlled form inputs** | React inputs whose value is state, so you can validate and disable Submit until the form is valid. | [React: Controlled components](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable) |
| **Modal dialog + focus** | An overlay that takes focus for a single task (you built the same shape for Manual Assign in U6). | [MDN: dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) |
| **Refetch after mutation** | After creating, re-`GET` the list so state matches the server rather than guessing (reused from U4/U6/U7). | [Redux Toolkit: async logic](https://redux-toolkit.js.org/usage/usage-guide#async-requests-with-createasyncthunk) |
| **Server-side validation is the boundary** | The client blocks obvious mistakes for UX, but the server is what actually enforces the rules (unique name, required fields). | [OWASP: Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, create + delete thunks (12) → Step 2, button + modal with lot number (20) → Step 3, select-new-lot + handoff (5) → Step 4, Remove Lot (8) → test & commit (15).

You need **U8** merged (or on your machine) and backend **B9** running. This CR **depends on** both.

**The backend contract this lesson calls (backend B9):**

- `POST /api/lots` — admin only. Body `{ name: string, number?: number, capacity?: number, display_order?: number }`. Creates the lot (and, if `capacity` is given, that many `available` spaces with no position yet — you place them in U8). The optional **`number`** is a non-negative integer, **unique across lots** (defaults to the lot's `display_order` when omitted); auto-generated spaces are labelled `<number>-<n>`. Returns the new `Lot` (including `number`). Rejects a blank/duplicate `name` **or a duplicate `number`** with `400`/`409` and the standard `{error:{message}}` envelope.
- `DELETE /api/lots/:id` — admin only. Removes the lot and cascade-deletes its spaces and any interest rows referencing it. Returns **`409`** (with the standard error envelope) if **any** space in the lot is currently `assigned` — the admin must unassign first (U6). This mirrors the "can't delete an assigned space" guard on the layout endpoint (U8/B8).

> **📸 What's already in the prototype:** the bottom nav is built from `['Home', ...Array.from({ length: 17 }, (_, i) => \`Lot ${i + 1}\`)]` — a hard-coded list. Since **U3** you already replaced that with `lots.map(...)` fed by `fetchLots()`. This lesson just adds a way to *grow* that server list; if your U3 change is in place, a new lot appears in the nav for free once `fetchLots()` re-runs.

**Make your branch.** U9 continues from U8:

```bash
git checkout cr/u8-arrange-spots
git checkout -b cr/u9-add-lot
```

---

## 🛠 Build it, step by step

### Step 1 — Add a `createLot` thunk to `parkingSlice.ts` (~10 min)

Put it next to `fetchLots`:

```ts
// POST /api/lots { name, number?, capacity? } -> Lot
export const createLot = createAsyncThunk(
  "parking/createLot",
  async (args: { name: string; number?: number; capacity?: number }, { dispatch }) => {
    const lot = (await api.post("/api/lots", args)) as Lot;
    await dispatch(fetchLots());     // refresh the nav list with the new lot included
    return lot;                       // return it so the UI can auto-select it
  }
);

// DELETE /api/lots/:id  (server refuses with 409 if any space is assigned)
export const deleteLot = createAsyncThunk(
  "parking/deleteLot",
  async (lotId: number, { dispatch }) => {
    await api.del(`/api/lots/${lotId}`);
    await dispatch(fetchLots());     // refresh the nav; the removed lot is gone
    return lotId;
  }
);
```

Handle their states in `extraReducers`:

```ts
.addCase(createLot.fulfilled, (state, action) => {
  state.selectedLotId = action.payload.id;   // jump to the new lot
})
.addCase(createLot.rejected, (state, action) => {
  state.error = action.error.message ?? "Could not create the lot";
})
.addCase(deleteLot.fulfilled, (state, action) => {
  if (state.selectedLotId === action.payload) state.selectedLotId = null;   // back to Home, but only if the deleted lot was the one showing
})
.addCase(deleteLot.rejected, (state, action) => {
  state.error = action.error.message ?? "Could not remove the lot";
});
```

**Explanation:**
- The thunk returns the created `Lot`, and `createLot.fulfilled` sets `selectedLotId` to it — that's the "land on the new lot" behavior. → [MDN: POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST).
- `dispatch(fetchLots())` reuses the **refetch-after-mutation** pattern (U4/U6/U7): don't hand-append to the list, just re-ask the server so the client can't drift out of sync.
- `deleteLot.rejected` carries the server's `409` message (e.g. "unassign its spaces first") straight into `state.error` — the client never has to know the rule, it just shows what the server said. You'll *also* gate the button client-side (Step 4) so the common case never even sends a doomed request.

### Step 2 — Add the button and the Create Lot modal in `ControlBoard.tsx` (~20 min)

**2a. Local modal state** near the top of `ControlBoard`:

```tsx
const [showAddLot, setShowAddLot] = useState(false);
const [lotName, setLotName] = useState('');
const [lotNumber, setLotNumber] = useState('');
const [lotCapacity, setLotCapacity] = useState('');
```

**2b. The button.** Add **➕ Add Lot** to the admin sidebar. Unlike the edit actions, this is a management action, so it isn't gated behind Edit Mode — but it *is* admin-only (the whole control panel already only renders for `isAdmin`). Put it just above the account section, or as the first control-panel button:

```tsx
<button
  style={sideButtonStyle(false, false)}
  onClick={() => { setLotName(''); setLotNumber(''); setLotCapacity(''); setShowAddLot(true); }}
>
  ➕ Add Lot
</button>
```

**2c. The modal.** Mirror the Manual Assign modal you built in U6:

```tsx
{showAddLot && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
    <div style={{ background: 'white', color: '#333', borderRadius: '10px', padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <div style={{ fontWeight: 'bold' }}>Create Parking Lot</div>

      <label style={{ fontSize: '0.85rem' }}>Name
        <input autoFocus value={lotName} onChange={(e) => setLotName(e.target.value)}
          placeholder="e.g. North Lot"
          style={{ width: '100%', border: '1px solid #ccc', borderRadius: '6px', padding: '8px', marginTop: '4px' }} />
      </label>

      <label style={{ fontSize: '0.85rem' }}>Lot number (optional)
        <input type="number" min={0} value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
          placeholder="e.g. 7 — prefixes spot labels as 7-1, 7-2…"
          style={{ width: '100%', border: '1px solid #ccc', borderRadius: '6px', padding: '8px', marginTop: '4px' }} />
      </label>

      <label style={{ fontSize: '0.85rem' }}>Capacity (optional)
        <input type="number" min={0} value={lotCapacity} onChange={(e) => setLotCapacity(e.target.value)}
          placeholder="how many spaces to start with"
          style={{ width: '100%', border: '1px solid #ccc', borderRadius: '6px', padding: '8px', marginTop: '4px' }} />
      </label>

      {error && <div style={{ color: '#b00', fontSize: '0.8rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAddLot(false)}
          style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #ccc', background: '#eee', cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          disabled={!lotName.trim() || status === 'loading'}
          onClick={async () => {
            const res = await dispatch(createLot({
              name: lotName.trim(),
              number: lotNumber ? Number(lotNumber) : undefined,
              capacity: lotCapacity ? Number(lotCapacity) : undefined,
            }));
            if (createLot.fulfilled.match(res)) setShowAddLot(false);   // close only on success
          }}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none',
            background: lotName.trim() ? '#b33' : '#ccc', color: 'white',
            cursor: lotName.trim() ? 'pointer' : 'not-allowed' }}>
          Create
        </button>
      </div>
    </div>
  </div>
)}
```

Add `createLot` (and `deleteLot`, used in Step 4) to the `./store/parkingSlice` import list.

**Explanation:**
- The **Create** button is disabled until the name is non-blank — client-side UX only. The server still enforces the real rules (`400`/`409`), and `createLot.rejected` puts that message into `state.error`, which the modal renders in red. → [OWASP: Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).
- `createLot.fulfilled.match(res)` — the dispatch returns an action; we only close the modal if it *succeeded*, so a rejected create keeps the modal open with the error visible. → [Redux Toolkit: `unwrapResult`/matchers](https://redux-toolkit.js.org/api/createAsyncThunk#checking-errors-after-dispatching).
- **Lot number** is optional. When set, the server stores it (rejecting a duplicate with `409`) and every spot you add in U8 auto-labels `<number>-<n>` (e.g. `7-1`), so a spot's label tells you its lot at a glance. Leave it blank and the server defaults it to the lot's display order. It's a plain number field — the same disabled/`state.error` handling covers a duplicate.
- Capacity is optional; when given, the backend seeds that many positionless spaces you'll place in U8 (labelled with the lot number prefix if you set one).

### Step 3 — Hand off to map + arrange (~5 min)

Because `createLot.fulfilled` already set `selectedLotId` to the new lot, the canvas switches to it automatically. Give the admin the obvious next step by showing a hint when the selected lot has no spaces yet. In the main content, near the canvas:

```tsx
{selectedLotId != null && (spacesByLot[selectedLotId]?.length ?? 0) === 0 && (
  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#eee' }}>
    New lot created. Next: <b>Update School Map</b> to add its photo, then <b>Arrange Spots</b> to place its spaces.
  </div>
)}
```

**UI mock (after this phase).** Clicking **➕ Add Lot** opens the modal; after Create, the nav gains the lot and it's selected with a next-step hint.
```
   click ➕ Add Lot                 after Create
┌───────────────┐        ┌────────────────────────────┐
│ │➕ Add Lot  │◀─────── │  Create Parking Lot         │
│ │ Single    │ │        │  Name     [North Lot____]   │
│ │ Group     │ │        │  Capacity [ 20 ]            │
│ │ Arrange   │ │        │        [Cancel] [Create]    │
│ └───────────┘ │        └────────────────────────────┘
└───────────────┘   ▶ nav: [Home][Lot A]…[Lot 17][North Lot]  ← new, selected
                      "New lot created. Next: Update School Map, then Arrange Spots."
```

### Step 4 — Add a gated **🗑 Remove Lot** button (~8 min)

Removing a lot is the mirror of creating one — but with a **safety rule**: you must never delete a lot that still has a student assigned to one of its spaces, or you'd orphan that spot. You enforce this in two places (defense in depth): the **server** returns `409` (the real boundary), and the **client** disables the button so the common case never sends a doomed request.

Add this to the admin control panel, near **➕ Add Lot** (both are admin-only management actions):

```tsx
{selectedLotId != null && (() => {
  const spaces = spacesByLot[selectedLotId] ?? [];
  const hasAssigned = spaces.some((s) => s.status === 'assigned');
  return (
    <div>
      <button
        style={sideButtonStyle(false, hasAssigned)}
        disabled={hasAssigned || status === 'loading'}
        onClick={() => {
          if (window.confirm('Remove this lot and all its spaces? This cannot be undone.')) {
            dispatch(deleteLot(selectedLotId));
          }
        }}
      >
        🗑 Remove Lot
      </button>
      {hasAssigned && (
        <div style={{ fontSize: '0.75rem', color: '#eee' }}>
          Unassign its spaces first (U6) before you can remove this lot.
        </div>
      )}
    </div>
  );
})()}
```

**Explanation:**
- The button only shows when a lot is selected (`selectedLotId != null`) — Home has nothing to remove.
- `hasAssigned` checks the lot's spaces for an `assigned` one and **disables** the button with an explanatory note. This is UX only; the rule is really enforced by the server's `409`, which `deleteLot.rejected` would still surface if the state were stale. → [MDN: HTTP DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE).
- `window.confirm` guards the destructive click. On success, `deleteLot.fulfilled` nulls `selectedLotId` — it only does that when the deleted lot was the one selected, which here it always is (you dispatched `deleteLot(selectedLotId)`) — so the view returns to Home, and `fetchLots()` has already dropped the lot from the nav.

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running through **B9** (seeded); `npm run dev`; log in as admin.
2. **Steps:** click **➕ Add Lot** → type a name (e.g. `North Lot`), lot number `7`, capacity `10` → **Create**. Open **Arrange Spots** (U8) and confirm the seeded spots are labelled `7-1, 7-2, …`. Then try creating one with a **blank** name, one with a **duplicate** name, and one with a **duplicate number**. Next, on a lot with **no** assignments, click **🗑 Remove Lot** → confirm. Then pick a lot that **does** have an assigned space and check the Remove button. Finally **refresh** the page. Log out and back in as a **student**.
3. **Expected:**
   - The new lot appears in the bottom nav immediately and is **selected**; the "next step" hint shows.
   - Its auto-seeded/added spots are labelled with the **lot-number prefix** (`7-1, 7-2, …`).
   - The **Create** button is disabled for a blank name; a duplicate name **or a duplicate number** shows a **red error** and the modal stays open.
   - **🗑 Remove Lot** on an all-unassigned lot deletes it (after the confirm) and returns you to Home; the lot vanishes from the nav.
   - **🗑 Remove Lot** is **disabled with a note** when the lot has an assigned space; if you force the call, the server's `409` message appears.
   - After **refresh**, a created lot is still listed and a removed lot is still gone (persisted).
   - Selecting the new lot, you can **Update School Map** (U7) and **Arrange Spots** (U8) on it end-to-end.
   - A **student** never sees the ➕ Add Lot or 🗑 Remove Lot controls.

**☁️ Cloud check (optional):** needs backend **B9** deployed. `./release.sh all`, create a lot on the live site, **refresh** — it persists in RDS; a second browser sees it too. Remove an empty lot and confirm it's gone after refresh. Bonus full loop: create a lot → upload its map (U7) → arrange its spots (U8) → log in as a student and confirm the new lot shows in availability.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U9: admin can create (with lot number) and remove lots (POST/DELETE /api/lots) + hand off to map/arrange"
git push -u origin cr/u9-add-lot
```

Open a PR with **base = `cr/u8-arrange-spots`**. Paste your "Prove it works" output. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). Record the PR in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## 🧯 If something breaks

- **New lot doesn't appear until I refresh** — your `createLot` thunk isn't `await`ing `dispatch(fetchLots())`, or your nav is still the hard-coded `Lot 1..17` list instead of `lots.map(...)` from U3.
- **Modal closes even when the create failed** — you're closing unconditionally; only close inside `if (createLot.fulfilled.match(res))`.
- **Duplicate/blank name (or duplicate number) crashes instead of showing an error** — confirm the `api` client throws on non-`ok` (U0) and that `createLot.rejected` writes `state.error`; the modal must render `state.error`.
- **New spots aren't prefixed with the lot number** — the label prefix is applied where a spot is *created* (the backend for auto-seeded capacity spaces, and `addSpotToDraft` in U8 for spots you add). If you left the lot number blank, the server defaulted it to the display order — that's expected.
- **🗑 Remove Lot is always disabled** — your `hasAssigned` check is reading the wrong lot's spaces; make sure it reads `spacesByLot[selectedLotId]`, not a stale/other lot.
- **Remove Lot deletes even though a space is assigned** — you're relying only on the client gate; the real guard is the server's `409`. Confirm the backend refuses, and that `deleteLot.rejected` surfaces the message.
- **A student can see ➕ Add Lot / 🗑 Remove Lot** — the buttons must live inside the `isAdmin`-only control panel, not the shared area.
- **Created lot has no spaces to arrange** — that's expected if you left capacity blank; either pass a capacity or add spots with **➕ Add Spot** in **Arrange Spots** (U8).
- **403 on create/delete** — you're not logged in as an admin, or the token isn't attached; check the Network tab (same cause as other admin-only calls).

---

## 📝 Recap — what you built and learned

- You made the UI **create and delete a top-level resource** for the first time (`POST`/`DELETE /api/lots`), not just read or edit seeded rows.
- You built a **validated create-form in a modal** that blocks obvious mistakes but defers the real rules to the server (blank/duplicate name, **duplicate lot number**), showing its errors inline.
- You learned the **lot-number convention** — an admin-set, unique number that prefixes every spot label (`7-1`), so a label carries its lot.
- You added a **destructive action done safely**: a `window.confirm`, a client-side gate that disables Remove when a space is assigned, and the server's `409` as the real boundary (defense in depth).
- You used the **refetch-after-mutation** pattern once more and auto-selected the new lot to keep the admin moving.
- You **composed** this feature with U7 and U8 into a full "stand up a lot from scratch" workflow — new lot → map → arranged spots — instead of duplicating what those CRs already do.

---

## 📚 References

- [MDN — HTTP POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) — creating a resource.
- [MDN — HTTP DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) — removing a resource (and the `409 Conflict` you get when it isn't safe).
- [React — Controlled components](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable) — form inputs backed by state.
- [Redux Toolkit — createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) and [checking errors after dispatch](https://redux-toolkit.js.org/api/createAsyncThunk#checking-errors-after-dispatching) — the `createLot` thunk and `.fulfilled.match`.
- [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) — why the server, not the form, is the real boundary.
- Source of truth for this lesson: [ui guide → CR U9](../ui-development-guide.md#cr-u9--add-a-new-parking-lot-from-the-admin-ui).

---

## ➡️ Next lesson

This is the **last of the core U0–U9 lessons** — admins can now create and remove lots, place their photos and spots, and run the full student/admin flow on real, saved data.

There is one **extension lesson** built during the PoC beyond the original ten: **[U10 — Student Management (the roster + CSV)](U10-student-management.md)**, which adds an admin-managed student roster and the ability to place a student directly into a spot. Do it if your school needs a roster; otherwise skip straight to deployment.

Then put the whole app online: the **[Deploy track, starting with Lesson D0 — AWS account setup](../../deploy/lessons/D0-aws-account-setup.md)**. (For what's still planned after this — validation polish and automated tests — see the hardening rows in [plan.md §8.2](../../plan.md#82-cr-status-tracker).)
