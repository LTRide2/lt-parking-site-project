# Lesson U10 — Student Management (the roster + CSV) — *extension*

> **Track:** Frontend · **Extension lesson** (built during the PoC, beyond the core U0–U9)
> **⏱ Time:** ~75 min · **🎚 Difficulty:** moderate–hard (a full CRUD screen, a file upload, a CSV round-trip, and a cross-entity assign — but every piece reuses patterns you already know)
> **🧩 Prerequisites:** you've done [Lesson U9 — Add (and remove) a parking lot](U9-add-a-parking-lot.md); the backend's **student-roster endpoints** (see the contract below) running.
> **🌿 CR branch:** `cr/u10-student-management` (off `cr/u9-add-lot`) · **🗺 Big picture:** [plan.md §2 (features beyond U0–U9)](../../plan.md#2-what-we-have-in-the-ui-today) and the extensions note in [plan.md §8.2](../../plan.md#82-cr-status-tracker)

---

## 🎯 Goal — what you'll have at the end

So far the only "students" the app knows are **login accounts** — a code that lets someone in. But a school office thinks in terms of a **roster**: a list of every student, their grade, their contact email, and whether they currently hold a parking spot — kept up to date in a spreadsheet. This lesson builds that roster as a first-class, admin-managed entity, separate from the login record.

By the end of this hour an **admin** can:

- See a searchable **student table** (name, student ID, grade, email, parking status, assigned slot).
- **Add / edit / delete** a student row.
- **Import a [CSV](GLOSSARY.md#csv)** (a spreadsheet export) that *upserts* the roster — new rows added, existing ones updated — keyed by the **student ID**.
- **Download a CSV** in the same columns, so it round-trips: export → edit in a spreadsheet → re-import.
- **Assign or move** a student straight to a lot spot — including a student who has no login account and never filed a request.

**✅ Done when (your deliverable checklist):**
- [ ] An admin opens a **Students** view; a student never sees it.
- [ ] The table lists seeded students and **filters** as you type in the search box (by name *or* student ID).
- [ ] You can **add** a student (blank first/last/ID blocked; a **duplicate student ID** shows the server's red error), **edit** one inline, and **delete** one.
- [ ] **Import CSV** of `First,Last,studentId,email,grade` adds new students and updates existing ones (by student ID), and shows an `added / updated / errors` summary.
- [ ] **Download CSV** produces a file in those exact columns that re-imports cleanly.
- [ ] **Assign / Move** places a student into a chosen lot's available spot; the button reads **Assign** when they hold no slot and **Move** when they already hold one; assigning frees any spot they previously held.
- [ ] The roster's **parking status** and **assigned slot** update when you assign/unassign (from here or from U6).
- [ ] Work committed on `cr/u10-student-management` and pushed, PR base = `cr/u9-add-lot`.

**🖼 What changes on screen (before → after):**
```
      BEFORE (no roster)                       AFTER (Student Management)
┌───────────────────────────┐      ┌─────────────────────────────────────┐
│      Admin Dashboard      │      │  👥 Students     [Import] [Export]  │
│                           │      │  Search: [ STU___________ ]         │
│  (no student list — a    │  ─▶  │  Name       ID     Grade  Status  •  │
│   "student" only exists   │      │  Doe, Jane  STU001  10   valid  Move│
│   as seeded login data)   │      │  Roe, Sam   STU014   9   unassn Asgn│
│                           │      │       [ + Add Student ]             │
└───────────────────────────┘      └─────────────────────────────────────┘
  no admin view of students           a searchable table with Add/Edit/
  at all — only seed data              Delete, CSV Import/Export, and a
                                        per-row Assign/Move action
```

---

## 🤔 Why this lesson matters

Every entity so far — lots, spaces, interest, assignments — is *parking* data. The roster is different: it's **people** data the office already maintains, and it arrives as a **spreadsheet**, not typed in one row at a time. Two ideas make this lesson worth an hour:

- **A business key vs a surrogate id.** The roster is keyed by the **student ID** the school assigns (`STU001`), not the database's auto-increment `id`. That's the value a CSV import matches on, and the value that links a roster student to their login account (`user.code === student.student_id`). Choosing the right key is what makes an *upsert* — "update if it exists, else insert" — possible.
- **Meeting users where their data is.** Bulk CSV import/export means the office doesn't retype hundreds of students; they export from their existing system and upload. Building an import that reports `added / updated / errors` (instead of failing the whole file on one bad row) is a small, real-world-grade feature.

It also closes a gap U6 left: U6 assigns a spot to a student who **filed a request**. But a CSV-imported student has no request — so this lesson adds a way to place *any* roster student into a spot directly.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **Business key vs surrogate key** | The roster is identified by the school's `student_id`, not the DB's `id`; the business key is what imports and links match on. | [Wikipedia: Natural key](https://en.wikipedia.org/wiki/Natural_key) |
| **Upsert** | "Update if it exists, else insert" — how the CSV import merges into the roster by `student_id`. | [Wikipedia: Merge (upsert)](https://en.wikipedia.org/wiki/Merge_(SQL)) |
| **Multipart file upload** | Sending a file (the CSV) to the server as `multipart/form-data`, not JSON. | [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) |
| **Client-side file download** | Building a file in the browser (a `Blob` + object URL) and clicking it to save — no server round-trip. | [MDN: Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) |
| **Debounced / live search** | Filtering the list as the admin types (the query is sent to `GET /api/students?q=`). | [MDN: input event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/input_event) |

> **New words ahead?** Every bolded term below links to the [**Glossary**](GLOSSARY.md) the first time it appears — click any you don't know, read the one-sentence version, and jump back. You never have to memorize a term before the lesson uses it.

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, `studentsSlice` (12) → Step 2, the table + search (15) → Step 3, add/edit/delete (12) → Step 4, CSV import + download (16) → Step 5, Assign/Move (10) → test & commit (5).

**The backend contract this lesson calls (student-roster [endpoints](GLOSSARY.md#endpoint)).** The roster is a **new `students` entity**, keyed by `student_id` (a string like `STU001`), *separate* from the login user. Columns: `first, last, student_id (unique), email, grade (9–12), assigned_slot (display text like "Lot 7 · 7-3", or null), parking_status`. `parking_status ∈ {unassigned, valid, expired, suspended}` — whether the student holds/paid for a slot (`valid` = assigned, `suspended` = suspended, `unassigned` = none/unassigned-by-admin, `expired` = lapsed).

- `GET /api/students?q=` — admin. Search by **name OR student ID substring** (case-insensitive), sorted last-then-first.
- `POST /api/students` — admin. `{ first, last, student_id, email?, grade? }`; `first/last/student_id` required; **`409` on duplicate `student_id`**; defaults `assigned_slot=null, parking_status=unassigned`; `201`.
- `PATCH /api/students/:id` — admin. Edit `first,last,email,grade,student_id,parking_status`; re-checks `student_id` uniqueness; validates `parking_status` against the enum.
- `DELETE /api/students/:id` — admin. `404` if missing, else `204`.
- `POST /api/students/import` — admin. **Multipart** CSV, columns `First,Last,studentId,email,grade`; **upsert keyed by `student_id`**; header row optional; returns `{ added, updated, errors[] }` (a per-row error never fails the whole file).
- `POST /api/students/:id/assign { spaceId }` — admin. The target space must be `available` (else `409`); **frees any spot the student already holds first** (move semantics); sets the space's `assigned_student_id` (and `assigned_user_id` if the student has a login account); sets the roster's `assigned_slot` + `parking_status=valid`; if the student has a login account, points their active request at the new lot and fulfils it.

> **The auth ↔ roster link.** The PoC links a login account to its roster row by `user.code === student.student_id`. On the real backend this becomes a foreign key. It's why a spot carries **both** `assigned_user_id` (the login) and `assigned_student_id` (the roster) — a roster student with no login can still hold a spot.

**Make your branch.** U10 continues from U9:

```bash
git checkout cr/u9-add-lot
git checkout -b cr/u10-student-management
```

---

## 🛠 Build it, step by step

### Step 1 — Create `studentsSlice.ts` (~12 min)

A new slice, registered in the store next to `parkingSlice`. It holds the list, the search query, and thunks for each endpoint. The shape mirrors the slices you've built since U3 — `status`, `error`, and `createAsyncThunk`s that refetch after a mutation.

```ts
// One roster row exactly as the backend returns it: `id` is the DB's own auto-increment
// (surrogate) key; `student_id` is the school's business key — what imports/logins match on.
export interface Student {
  id: number; first: string; last: string; student_id: string;
  email: string; grade: string; assigned_slot: string | null;   // display text, or null while unassigned
  parking_status: "unassigned" | "valid" | "expired" | "suspended"; // union of literals — a typo is a compile error
}

// The editable fields the admin can send when creating or updating a student
// (not `Partial<Student>` — the roster's identity/status fields are modeled explicitly here).
export interface StudentDraft {
  first: string; last: string; student_id: string;
  email: string; grade: string; parking_status?: Student["parking_status"];
}

export interface ImportSummary { added: number; updated: number; errors: string[]; } // per-row errors, never all-or-nothing

interface StudentsState {
  list: Student[]; query: string;                                  // query = the live search box text
  status: "idle" | "loading" | "error"; error: string | null;
  lastImport: ImportSummary | null;                                 // most recent CSV import result, or null
}

export const fetchStudents = createAsyncThunk(
  "students/fetch",
  (query: string = "") => api.get(`/api/students?q=${encodeURIComponent(query)}`) as Promise<Student[]>
);

export const createStudent = createAsyncThunk(
  "students/create",
  async (draft: StudentDraft, { getState, dispatch }) => {
    await api.post("/api/students", draft);
    // refetch-after-mutation, using the ACTIVE search query so a filtered view isn't reset
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  }
);

export const updateStudent = createAsyncThunk(
  "students/update",
  async (args: { id: number; changes: Partial<StudentDraft> }, { getState, dispatch }) => {
    await api.patch(`/api/students/${args.id}`, args.changes);
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  }
);

export const deleteStudent = createAsyncThunk(
  "students/delete",
  async (id: number, { getState, dispatch }) => {
    await api.del(`/api/students/${id}`);
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  }
);

// Place a roster student directly into a spot (Assign or Move) — no request or login needed.
export const assignStudent = createAsyncThunk(
  "students/assign",
  async (args: { id: number; spaceId: number }, { getState, dispatch }) => {
    await api.post(`/api/students/${args.id}/assign`, { spaceId: args.spaceId }); // server frees any old spot first
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  }
);

// POST /api/students/import (multipart CSV), via the `uploadFile()` helper from client.ts.
export const importStudents = createAsyncThunk(
  "students/import",
  async (file: File, { getState, dispatch }) => {
    const summary = (await uploadFile("/api/students/import", file)) as ImportSummary; // { added, updated, errors }
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
    return summary;                                                                    // becomes state.lastImport
  }
);
```

**Why it works & further reading:**
- **[Interface](GLOSSARY.md#interface) `Student`** vs **`StudentDraft`** — `Student` is the full row the server returns; `StudentDraft` is only what a human types (no `id`, no `assigned_slot` — those are server-owned). → [TS Handbook: Object Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types).
- **Business key vs surrogate key** — `student_id` is what a CSV import and the login link match on; `id` is only for `PATCH`/`DELETE`. → [Wikipedia: Natural key](https://en.wikipedia.org/wiki/Natural_key).
- **Refetch-after-mutation** — every mutating [thunk](GLOSSARY.md#thunk) ends by re-[dispatch](GLOSSARY.md#dispatch)ing `fetchStudents`, the same habit from U4/U6/U9, but reading the *active* `query` out of [state](GLOSSARY.md#state) first so a mutation made mid-search doesn't clear the filter.
- **Search happens on the server** (`?q=`) — the client never holds a "full list" it has to filter itself; simpler, and it scales.
- **`assignStudent`** is the cross-entity piece: it doesn't create an interest request, it places the student directly — the server handles the "free the old spot first" move semantics.
- **`importStudents`** posts through the `uploadFile()` multipart helper, not `api.post`, because a file isn't JSON (see Step 4).
- **[`extraReducers`](GLOSSARY.md#extrareducers)** wires each thunk's pending/fulfilled/rejected the same way as U1/U3's [slices](GLOSSARY.md#slice): `pending` → loading + clear error, `fulfilled` → store the payload, `rejected` → `state.error = action.error.message`. `query`, `lastImport`, and `error` are each cleared/set by their own plain (non-thunk) [reducer](GLOSSARY.md#reducer) (`setQuery`, `clearImportSummary`, `clearStudentsError`). Register the slice in the [store](GLOSSARY.md#store)'s `store.ts`.

### Step 2 — The Students view: table + live search (~15 min)

Create `src/StudentManagement.tsx` — an admin-only pane. It isn't a separate route: the Admin Control Board holds a `managingStudents` boolean in state, and a **👥 Student Management** sidebar button toggles it, rendering `<StudentManagement onClose={...} />` as an in-place **overlay** on top of the board (same admin-only gating as ➕ Add Lot) rather than navigating anywhere.

```tsx
export function StudentManagement({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { list, query } = useAppSelector((s) => s.students);   // selector: roster + current search term, both from the store

  useEffect(() => { dispatch(fetchStudents("")); }, [dispatch]);   // initial load: full roster on open

  // Search updates the *store's* query, then fetches with it — see the note below.
  const onSearch = (term: string) => { dispatch(setQuery(term)); dispatch(fetchStudents(term)); };

  return (
    <div>
      <button onClick={onClose}>✕ Close</button>
      <input value={query} onChange={(e) => onSearch(e.target.value)}
        placeholder="Search name or student ID…" />
      <table>
        <thead><tr><th>Name</th><th>Student ID</th><th>Grade</th><th>Email</th><th>Status</th><th>Slot</th><th></th></tr></thead>
        <tbody>
          {list.map((s) => (                                    // one <tr> per student the server returned
            <tr key={s.id}>                                      {/* stable key — never the array index */}
              <td>{s.last}, {s.first}</td><td>{s.student_id}</td><td>{s.grade}</td>
              <td>{s.email}</td><td>{s.parking_status}</td><td>{s.assigned_slot ?? "—"}</td>  {/* — = no slot yet */}
              <td>{/* edit · delete · assign — Steps 3 & 5 */}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Why it works & further reading:**
- **Why the search term lives in the store, not [`useState`](GLOSSARY.md#usestate)** — every mutating [thunk](GLOSSARY.md#thunk) (`createStudent`, `updateStudent`, `deleteStudent`, `assignStudent`, `importStudents`) re-fetches the list when it finishes, reading the *current* filter from `getState().students.query`. If the term lived only in local component state, those re-fetches would use an empty query and silently drop whatever filter the admin had typed — so `onSearch` [dispatches](GLOSSARY.md#dispatch) `setQuery` (updates the store) **and** `fetchStudents(term)` (reflects it immediately).
- The one-time `useEffect(() => dispatch(fetchStudents("")), [dispatch])` just loads the full roster on open; after that, `onSearch` drives every fetch — no effect keyed on `query`.
- **Server-side filtering** — the `?q=` param means typing narrows the list with zero client-side filtering code.
- **`list.map(...)`** is the same "array of data → array of elements" pattern U3 used for lots and spaces: it turns the fetched `Student[]` into one `<tr>` per row. → [React docs: Rendering Lists](https://react.dev/learn/rendering-lists).
- **`key={s.id}`, never the array index** — React needs a stable id per row to tell "this row moved" from "this row was replaced" across re-renders (e.g. when a keystroke shrinks the filtered list); `s.id` is the roster's own surrogate key from Step 1. → [React docs: Rendering Lists](https://react.dev/learn/rendering-lists).

### Step 3 — Add, edit, delete a student (~12 min)

Reuse the **modal + validated form** shape from U9's Create Lot and U6's assign modal:

- An **➕ Add Student** button opens a modal with `first`, `last`, `student_id` (all required), `email`, `grade`. On submit, it dispatches `createStudent(...)`; only close on `createStudent.fulfilled.match(res)` so a **duplicate student ID** keeps the modal open with the server's `409` message in red.
- An **Edit** action per row opens the same modal pre-filled; submit dispatches `updateStudent({ id, changes })` — `changes` is a `Partial<StudentDraft>`, not a raw `Partial<Student>`.
- A **Delete** action per row does a `window.confirm` then `dispatch(deleteStudent(s.id))`.

There is nothing new here — it's the exact create/validate/refetch pattern from U9, applied to a second entity. The only twist is that the identity field (`student_id`) is editable and re-checked for uniqueness on the server.

### Step 4 — CSV import and download (~16 min)

**4a — Import.** A file input + a `POST /api/students/import` as **multipart** (not JSON):

```tsx
const onCsvChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];               // the one CSV the admin picked, if any
  if (file) dispatch(importStudents(file)); // thunk refetches with the active query and stores lastImport
  event.target.value = "";                             // reset so picking the SAME file again still fires onChange
};
// <input type="file" accept=".csv" onChange={onCsvChosen} />
```

Show the stored `lastImport` (`{ added, updated, errors }`) so the admin sees exactly what happened (e.g. *"Added 12, updated 3, 1 error: row 7 missing Last"*), with a **Dismiss** button that clears it via `dispatch(clearImportSummary())`.

**4b — Download.** Build the CSV in the browser from the currently displayed list and click a temporary link:

```tsx
const downloadCsv = () => {
  const header = "First,Last,studentId,email,grade";                   // must match the import's expected columns
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;      // quote-escape every cell
  const rows = list.map((s) => [s.first, s.last, s.student_id, s.email, s.grade].map(esc).join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });  // an in-memory file
  const url = URL.createObjectURL(blob);                                       // a temporary URL pointing at it
  const a = document.createElement("a");
  a.href = url; a.download = "students.csv"; a.click();                        // trigger the browser's "Save As"
  URL.revokeObjectURL(url);                                                     // free the temporary URL
};
```

**Why it works & further reading:**
- **Import is [`multipart/form-data`](GLOSSARY.md#formdata)**, not JSON, because a file isn't text. The `importStudents` thunk sends it through a dedicated `uploadFile(path, file)` helper that builds the `FormData` and sends it **without** a `Content-Type` header — the browser sets the multipart boundary itself. → [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- **Per-row errors, not an all-or-nothing failure** — the import upserts by `student_id` and collects one message per bad row, so a single typo doesn't lose 200 good rows.
- **Quote-escaping + a matching header** — `esc()` doubles any inner `"` so a name with a comma can't break the columns, and the header exactly matches what the import expects — that's what makes export → edit → re-import round-trip cleanly. → [MDN: Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

> **Mock-storage caveat (PoC only):** the [mock backend](GLOSSARY.md#mock-backend) keeps everything in [`localStorage`](GLOSSARY.md#localstorage); a very large CSV can bump the ~5 MB quota. A real backend stores the roster in the database and has no such limit.

### Step 5 — Assign / Move a student to a spot (~10 min)

A per-row **Assign / Move** action (label it **Assign** when `assigned_slot` is null, **Move** otherwise). It opens a small picker: choose a **lot**, then an **available spot** in that lot (reuse `fetchLots` / `fetchSpaces` from U3), confirm, then `dispatch(assignStudent({ id, spaceId }))`.

**Why it works & further reading:**
- **The direct-placement path U6 couldn't cover** — it works for a student **with no login and no request** (the server sets `assigned_student_id`).
- **One slot per student, enforced server-side** — assigning a student who already holds a spot frees the old one first (that's why the button reads "Move"); the client just calls the endpoint and refetches.
- **After it returns**, the roster row flips to `parking_status: valid` and shows the new `assigned_slot` — and `DELETE /api/assignments/:spaceId` (U6's Unassign) will later clear both.

---

## 🧪 Prove it works — testing guide

1. **Setup:** backend with the student-roster endpoints running (seeded); `npm run dev`; log in as admin; open **👥 Students**.
2. **Steps:** type part of a name, then part of a student ID, in the search box. **➕ Add Student** (try a blank required field and a **duplicate student ID**). **Edit** a row; **Delete** a row. **Import** a small CSV that includes one existing student ID and one new one, plus one bad row. **Download CSV**, open it, then re-import it. Finally **Assign** a request-less student to a spot, then **Move** them to a different lot.
3. **Expected:**
   - The list filters by name **and** by student ID as you type.
   - Add blocks blank required fields; a duplicate student ID shows a **red** server error and keeps the modal open. Edit and delete persist after refresh.
   - Import reports `added / updated / errors` — the existing ID is **updated**, the new one **added**, the bad row listed as an error (the rest still import).
   - The downloaded CSV re-imports with everything **updated** and nothing duplicated (round-trip).
   - Assign places the student (status → `valid`, slot shown); Move frees the old spot and places them in the new lot; the old spot is `available` again.
   - A **student** login never sees the Students view.

**☁️ Cloud check (optional):** with the roster endpoints deployed, import a real class-export CSV, assign a few students, and confirm from a second browser that the roster and the spot colors match.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "U10: student roster (Student Management) — CRUD, CSV import/export, direct assign/move"
git push -u origin cr/u10-student-management
```

Open a PR with **base = `cr/u9-add-lot`**. Paste your "Prove it works" output. Record the PR in the [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) — this is one of the PoC extensions noted there, so add its row when you open it.

---

## 🧯 If something breaks

- **Search returns everything / nothing** — confirm you pass `?q=` to `GET /api/students` and re-fetch when `query` changes; the *server* filters, the client shouldn't.
- **Duplicate student ID crashes instead of showing an error** — the `api` client must throw on non-`ok` (U0) and `createStudent.rejected` must write `state.error`; the modal renders it.
- **CSV import sends JSON / 415 or 400** — you must send `FormData` (multipart) and **not** set `Content-Type` yourself; let the browser add the boundary.
- **Import fails the whole file on one bad row** — the endpoint should collect per-row `errors[]` and still upsert the good rows; check you're reading the `{ added, updated, errors }` summary.
- **Downloaded CSV breaks on names with commas** — you didn't quote-escape cells; wrap each in quotes and double any inner `"`.
- **Assign says the spot is taken (409)** — the target space isn't `available`; pick a free one. Moving a student who holds a spot is fine — the server frees the old one first.
- **Roster status doesn't update after assign/unassign** — the assign endpoint must set `assigned_slot`/`parking_status`, and `DELETE /api/assignments/:spaceId` (U6) must clear them; refetch the roster after either.
- **A student can see the Students view** — the button/route must be inside the `isAdmin`-only area.

---

## 📝 Recap — what you built and learned

- You added a **second top-level entity** (the roster), keyed by a **business key** (`student_id`) rather than the database id — the key that imports and the login link both match on.
- You built a full **CRUD screen** with **server-side search**, reusing the modal/validate/refetch patterns from U6 and U9.
- You implemented a **CSV round-trip**: a multipart **upsert** import that reports `added / updated / errors`, and a client-side **download** in the same columns.
- You added a **cross-entity assign/move** that places any roster student (even one with no login or request) into a spot, with one-slot-per-student move semantics enforced by the server.

---

## 📚 References

- [MDN — FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) — multipart file upload for the CSV import.
- [MDN — Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL) — building the download in the browser.
- [Wikipedia — Natural key](https://en.wikipedia.org/wiki/Natural_key) — why the roster is keyed by `student_id`, not the DB id.
- [React — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — when fetching in a `useEffect` is (and isn't) the right call.
- Big picture: [plan.md §2](../../plan.md#2-what-we-have-in-the-ui-today) (features beyond U0–U9) and the extensions note in [plan.md §8.2](../../plan.md#82-cr-status-tracker).

---

## ➡️ Next lesson

That's the last frontend feature. Put the whole app online: the **[Deploy track, starting with Lesson D0 — AWS account setup](../../deploy/lessons/D0-aws-account-setup.md)**. (For what's still planned — validation polish and automated tests — see the hardening rows in [plan.md §8.2](../../plan.md#82-cr-status-tracker).)
