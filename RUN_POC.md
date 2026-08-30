# Run the PoC (frontend + mock backend)

The frontend runs **fully on its own** — no real backend needed. An in-memory mock
API (`src/api/mock/backend.ts`) implements the whole contract and persists to
`localStorage`, so refreshes behave like a real server.

## Start it

```bash
npm install      # first time only
npm run dev      # http://localhost:5173
```

## Log in

- **Admin:** `admin` / `admin123`
- **Students:** code `STU001` (Alice) or `STU002` (Bob)

## What to try

**Admin (`/admin`)**
- Click lots in the bottom nav. **Lot 1** has an authored layout (spots placed on the map); other lots show the fallback grid.
- Flip **Edit Mode** on, then:
  - **Single Select** → click spaces → **Disable** / **Enable** (persists across refresh).
  - **Manual Assign** → pick a pending request → click an available space (turns blue).
  - **Arrange Spots** → click the map to add spots, drag to move, **Rotate/Delete**, **Save Layout**.
  - **Update School Map** → upload a PNG/JPG.
  - **➕ Add Lot** → create a lot with a name and an optional **lot number** (used as the prefix for its spot labels, e.g. `7-1`); blank name → disabled, duplicate name/number → red error.
  - **🗑 Remove Lot** → deletes the selected lot and its spaces; disabled if any space is assigned.

**Student (`/student`)**
- See availability per lot and **Register interest** in a lot. Log in as admin in another
  window to assign it; refresh the student page to see it flip to **fulfilled**.

## Reset the demo data

In the browser console: `localStorage.removeItem('ltride.mockdb.v6')` then refresh.
(Or call the exported `resetMockDatabase()`.)

## Point at a real backend later

The app defaults to the mock. To hit a real server instead, create `.env`:

```
VITE_API_URL=http://localhost:8000
VITE_USE_MOCK=false
```

No frontend code changes — `src/api/client.ts` swaps the transport based on `VITE_USE_MOCK`.
