# Lesson U7 — Update the school map image

> **Track:** Frontend · **Lesson 8 of 10**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (your first request that isn't JSON — file uploads work differently)
> **🧩 Prerequisites:** you've done [Lesson U6 — Admin assigns spaces](U6-admin-assigns-spaces.md); the backend's map-upload endpoint (`POST /api/lots/:id/map`) running.
> **🌿 CR branch:** `cr/u7-map-upload` (off `cr/u6-admin-assign`) · **📄 Source CR:** [ui guide → CR U7](../ui-development-guide.md#cr-u7--update-the-school-map-image) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

Right now the **Update School Map** button just sits there — clicking it does nothing. By the end of this hour, clicking it opens your computer's file picker, and choosing a PNG or JPG uploads it to the server as the new map image for the lot you have selected — the Home view then shows the updated campus map.

Concretely, you will have:

- An `uploadFile` helper in `src/api/client.ts` that sends a file as `FormData` instead of JSON.
- An `uploadLotMap` thunk that `POST`s the file to `/api/lots/:id/map` and then refreshes the lots so the new image shows up.
- A hidden `<input type="file">` wired to the **Update School Map** button, so a click opens the OS picker instead of doing nothing.
- A shared `mapImg()` helper so the map image renders in **every** lot view — not only the one with spots already arranged on it.

**✅ Done when (your deliverable checklist):**
- [ ] Clicking **Update School Map** (with a lot selected) opens the OS file picker.
- [ ] Choosing a PNG/JPG uploads it; after the refresh, the Home view shows the new map image.
- [ ] A newly-created lot with **no spaces yet** still shows an uploaded map (not just lots with an arranged layout).
- [ ] Choosing a non-image file (e.g. a `.txt`) or an oversized file shows a **red error** — no crash.
- [ ] Choosing the *same* file a second time still triggers another upload (the picker doesn't silently ignore a repeat choice).
- [ ] Your work is committed on branch `cr/u7-map-upload` and pushed, PR base = `cr/u6-admin-assign`.

---

## 🤔 Why this lesson matters

Every request you've made so far — login, fetching lots, creating an assignment — has been **JSON**: a JavaScript object, turned into text, sent as the request body. A file upload can't work that way. An image is binary data, not text, and your existing `api` helper (built in U0) hard-codes `Content-Type: application/json` and runs `JSON.stringify` on the body. Force a file through that and you'd send a corrupted mess the server can't read.

The fix is a different **encoding**: `multipart/form-data`. Instead of one JSON blob, the request body is split into named "parts" (here, one part named `file` holding the raw image bytes), separated by a boundary string the *browser* generates for you — which is exactly why you must **not** set `Content-Type` yourself; the browser needs to write the boundary into that header.

That's also why Step 1 below builds a *second*, dedicated helper rather than teaching `api` a new trick: mixing "always JSON-encode" and "sometimes send raw bytes" into one function would make it harder to reason about, not easier. Recognizing "this request is fundamentally a different shape, so it gets its own path" — rather than jamming everything through one client function — is a decision you'll keep making as apps grow.

This is also a nice, small, complete feature to close out the frontend track on: one button, one file, one endpoint — and it's the last piece before the whole app goes live.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`FormData` & `multipart/form-data`** | A browser API (`FormData`) for building the request encoding that splits a body into named parts (text + raw file bytes) instead of one JSON blob. | [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) · [MDN: Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/FormData_API/Using_FormData_Objects) |
| **`<input type="file">`** | The native HTML element that opens the OS file picker and hands your code back a `File` object. | [MDN: `<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file) |
| **Vite static asset handling** | How Vite serves images placed in your source tree or `public/` folder, and rewrites their URLs for production builds. | [Vite: Static Asset Handling](https://vite.dev/guide/assets.html) |
| **Importing images in React (via Vite)** | `import mapImg from "./map.png"` gives your component a URL string, not the raw file — Vite fingerprints it for caching. | [Vite: Importing Asset as URL](https://vite.dev/guide/assets.html#importing-asset-as-url) |
| **Responsive images** | Serving an appropriately-sized image for the viewer's screen, instead of one giant file for every device. | [MDN: Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images) |
| **Image optimization** | Compressing/resizing images before they ship, so a slow connection doesn't wait on a multi-megabyte map. | [web.dev: Optimize images](https://web.dev/articles/fast/optimize-images) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, upload helper (10) → Step 2, upload thunk (10) → Step 3, wire the button (15) → Step 4, show the map in every lot view (10) → test & commit (10).

You need **U6** merged (or at least on your machine) and the backend's map-upload endpoint (`POST /api/lots/:id/map`) running — this CR **depends on** both.

**Make your branch.** U7 continues where U6 left off, so branch off `cr/u6-admin-assign`, not `main`:

```bash
git checkout cr/u6-admin-assign
git checkout -b cr/u7-map-upload
```

**What this does & why:** stacking branches this way means your PR for U7 only shows *this lesson's* diff, even though your working tree also has U6's code in it — GitHub compares against the U6 branch, not `main`. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Add an upload helper to `src/api/client.ts` (~10 min)

Your existing `api` helper always JSON-encodes. This upload needs a different body shape, so add a **separate** function next to it that reuses the same auth token:

```ts
// add to src/api/client.ts
export async function uploadFile(path: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;   // NOTE: no Content-Type — the browser sets it
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: fd, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
  return body.data;
}
```

**Explanation, line by line:**
- `new FormData()` / `fd.append("file", file)` — builds the multipart body with one part named `"file"` holding the raw `File` object the browser gave you. → [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- The `Authorization` header is set the same way `api` does it — the admin's login token still needs to ride along so the server knows who's asking. → [MDN: Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization).
- **No `Content-Type` header is set here.** When `fetch`'s `body` is a `FormData` object, the browser automatically writes `Content-Type: multipart/form-data; boundary=...` for you — and it's the *only* one who knows the exact boundary string it's about to use. Setting `Content-Type` yourself would very likely break the upload.
- `res.json().catch(() => ({}))` and the `!res.ok` check mirror the error-handling pattern `api` already uses, so a failed upload surfaces a readable message instead of an unhandled exception.
- `token` and `BASE` are module-level variables already defined in `client.ts` (from earlier lessons), so this helper can read them directly without any new imports.

### Step 2 — Add an upload thunk to `parkingSlice.ts` (~10 min)

```ts
import { api, uploadFile } from "../api/client";   // extend the existing import

// POST /api/lots/:id/map  (multipart) -> updated Lot
export const uploadLotMap = createAsyncThunk(
  "parking/uploadMap",
  async (args: { lotId: number; file: File }, { dispatch }) => {
    await uploadFile(`/api/lots/${args.lotId}/map`, args.file);
    await dispatch(fetchLots());     // refresh so the new map_url is in state
    return args.lotId;
  }
);
```

Handle its `rejected` case to surface errors:

```ts
.addCase(uploadLotMap.rejected, (state, action) => {
  state.error = action.error.message ?? "Map upload failed";
})
```

**Explanation:**
- `uploadLotMap`'s payload creator calls your new `uploadFile` helper (not `api`) — this is the one place in the whole app that sends a non-JSON request.
- After the upload succeeds, it `dispatch(fetchLots())` — the same **refetch-after-mutation** pattern from U6's `createAssignment`: rather than guessing what the server changed, ask it again and trust the fresh answer. That's what puts the new `map_url` into Redux state.
- The `.rejected` case writes any thrown error (including the message your `uploadFile` helper throws on a non-`ok` response) into `state.error`, the same field your existing error UI already reads.

> **Two things that make an uploaded map "not load" — worth knowing before you test.**
> - **Where the image lives (mock backend only).** If you run the PoC against the mock backend, it must store the file as a base64 **data URL** (`FileReader.readAsDataURL`), *never* `URL.createObjectURL(file)`. A `blob:` URL is valid only for the current page session — it renders once but is dead after a refresh and is meaningless once written to `localStorage`, so the map "doesn't load" on reload. A **real** backend persists the file and returns a durable URL, so it has no blob-lifetime bug. (Caveat: the mock's `persist()` swallows `QuotaExceededError` and base64 inflates size ~33%, so several multi-MB uploads can quietly exceed the ~5 MB `localStorage` quota — fine in-session, gone after reload.)
> - **Where the image is drawn (frontend).** The lot view must render `map_image_url` **whenever it exists** — in the no-spaces view, the fallback grid, the authored layout, *and* arrange mode. A common bug is drawing the `<img>` only in the authored-layout/arrange views, so a lot with no spaces or positionless spaces never shows a freshly uploaded map. U3/U8 centralize this in one small `mapImg()` helper used by every lot view; make sure yours does too, or your upload will "succeed" yet appear to do nothing.

### Step 3 — Wire the button in `ControlBoard.tsx` (~15 min)

A plain `<button>` can't open the OS file picker on its own — only a real `<input type="file">` can. The trick is to hide that input and trigger it programmatically from the button:

```tsx
import { uploadLotMap } from './store/parkingSlice';
// ...
const fileInputRef = useRef<HTMLInputElement>(null);

const onMapFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file && selectedLotId != null) dispatch(uploadLotMap({ lotId: selectedLotId, file }));
  e.target.value = "";   // allow re-choosing the same file later
};
```

Update the **Update School Map** button's `onClick` to open the picker, and add the hidden input nearby:

```tsx
<button
  style={sideButtonStyle(editAction === 'update', !isControlPanelActive)}
  onClick={() => { dispatch(setEditAction('update')); fileInputRef.current?.click(); }}
  disabled={!isControlPanelActive}
>
  Update School Map
</button>
<input
  ref={fileInputRef}
  type="file"
  accept="image/png,image/jpeg"
  style={{ display: 'none' }}
  onChange={onMapFileChosen}
/>
```

**Explanation:**
- `useRef<HTMLInputElement>(null)` creates a handle React can attach to the real DOM `<input>` element, so your code can call browser methods on it directly (`.click()`) instead of only reading its rendered value.
- `fileInputRef.current?.click()` is the whole trick: **you never show this input.** Clicking the visible button programmatically clicks the hidden one, which is what actually opens the OS file picker. → [MDN: `<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file).
- `accept="image/png,image/jpeg"` hints the OS picker to show/prefer image files — it's a UX nicety, **not** a security boundary; a user can still pick a renamed file, so the server must validate the real content (that's why a bad file still comes back as a 400/413 from the backend, not silently accepted).
- `onMapFileChosen` reads the chosen file off `e.target.files?.[0]` (file inputs always hold an array-like `FileList`, even for a single file), guards that a lot is selected, then dispatches `uploadLotMap`.
- `e.target.value = ""` at the end resets the input. Without this, choosing the *exact same file* a second time wouldn't fire `onChange` at all — the browser only fires it on a value **change**, and re-picking an identical file doesn't look like one unless the field was cleared first.

**UI mock (after this phase).** Pressing **Update School Map** opens the OS file picker; after a successful upload the campus image on Home refreshes.
```
┌───────────────┐        ┌─────────────────────────────┐
│ │ Single    │ │        │  Choose file to upload      │
│ │ Group     │ │        │  ┌───────────────────────┐  │
│ │ Disable   │ │  click │  │ lotA-map-2026.png   ▼ │  │
│ │ Enable    │ │ ─────▶ │  └───────────────────────┘  │
│ │ Manual    │ │        │       [Cancel]  [Open]      │
│ │ Update Map│◀┘        └─────────────────────────────┘
│ └───────────┘            (PNG/JPG only; others rejected
└───────────────┘             with a red error message)
```

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend running (with the map-upload endpoint); `npm run dev`; admin logged in.
2. **Steps:** **Edit Mode** on → **Update School Map** → pick a PNG/JPG → confirm. Then try a non-image (e.g. a `.txt`) or an oversized file.
3. **Expected:**
   - A valid image uploads; after the `fetchLots` refresh, the new map shows on the Home view.
   - Upload a map to a lot that has **no spaces yet** (or is on the fallback grid) → the image still shows, and after a full **page refresh** it's still there (proves the map renders in every view via `mapImg()`, and — on the mock — that it was stored as a durable data URL, not a session-only `blob:`).
   - A non-image or too-large file → the server rejects it (400/413) and you see a **red error**, no crash.
   - Re-selecting the exact same file a second time uploads again (Step 3's `e.target.value = ""` reset working).

**☁️ Cloud check (optional):** needs the backend map-upload endpoint deployed. `./release.sh all`, then upload an image on the live site. **Heads-up:** large uploads can hit nginx's `client_max_body_size` limit (default 1 MB → `413`). If real photos are rejected in the cloud but work locally, raise that limit in the nginx config (**Part 3 / nginx config** in the backend guide).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U7: admin map upload via multipart POST /api/lots/:id/map"
git push -u origin cr/u7-map-upload
```

Then open a Pull Request on GitHub with **base = `cr/u6-admin-assign`**. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Clicking the button doesn't open a picker** — check that `onClick` actually calls `fileInputRef.current?.click()` and that the `ref={fileInputRef}` is on the real `<input type="file">`, not some other element. `display: 'none'` on the input is fine — hidden inputs can still be `.click()`ed programmatically.
- **Upload fails with a 400/415 even for a real image** — you (or a proxy/library) may have accidentally set `Content-Type` on the request. Delete any explicit `Content-Type` header on this call; let the browser write it.
- **401/403 from the upload** — confirm you're logged in as an **admin** and that `uploadFile` is actually attaching the `Authorization` header (check the Network tab); a stale or missing `token` is the usual cause.
- **Map doesn't visually update after a successful upload** — confirm `uploadLotMap` really `await`s `dispatch(fetchLots())`; also check your browser isn't just showing a **cached** copy of the old image at the same URL (hard-refresh to rule this out). One more common cause: the lot view only draws the `<img>` for authored/arrange layouts, so a lot on the fallback grid (or with no spaces yet) never shows it — render `map_image_url` in **every** lot view via the shared `mapImg()` helper (U3/U8).
- **Uploaded map shows once, then vanishes after a refresh (mock backend)** — the mock stored `URL.createObjectURL(file)`, a session-scoped `blob:` URL. Store a base64 data URL (`FileReader.readAsDataURL`) so it survives reload. If even that doesn't persist, a multi-MB base64 image may have silently exceeded the ~5 MB `localStorage` quota (the mock's `persist()` swallows the error).
- **Choosing the same file twice does nothing the second time** — you're missing `e.target.value = ""` at the end of `onMapFileChosen`; without it, the browser doesn't fire `onChange` for a "repeat" selection.

---

## 📝 Recap — what you built and learned

- You learned **why** a file upload can't go through your JSON `api` helper, and built a small, dedicated `uploadFile` helper instead of forcing one function to do two jobs.
- You practiced the **hidden-`<input>` + programmatic `.click()`** trick for triggering the OS file picker from a styled button.
- You reused the **refetch-after-mutation** pattern from U6 (`uploadLotMap` → `fetchLots`) to keep the UI in sync with the server's new truth.
- You closed out the frontend track's core feature work — every button on the Admin Control Board now does something real.

---

## 📚 References

- [MDN — FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and [Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/FormData_API/Using_FormData_Objects) — building a multipart request body.
- [MDN — `<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file) — the native file picker element.
- [MDN — Authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) — how the admin's token rides along on the upload.
- [Vite — Static Asset Handling](https://vite.dev/guide/assets.html) and [Importing Asset as URL](https://vite.dev/guide/assets.html#importing-asset-as-url) — how the map image is served and referenced in code.
- [MDN — Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images) — serving the right image size per device.
- [web.dev — Optimize images](https://web.dev/articles/fast/optimize-images) — compressing images before they ship.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [ui guide → CR U7](../ui-development-guide.md#cr-u7--update-the-school-map-image).

---

## ➡️ Next lesson

Next: **[U8 — Place & arrange parking spots](U8-place-and-arrange-spots.md)** — a drag-and-drop editor that lets an admin position each lot's spaces on the map you just uploaded (backed by `PUT /api/lots/:id/layout`, backend B8).
