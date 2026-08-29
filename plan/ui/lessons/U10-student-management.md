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
- **Import a CSV** (a spreadsheet export) that *upserts* the roster — new rows added, existing ones updated — keyed by the **student ID**.
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

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → Step 1, `studentsSlice` (12) → Step 2, the table + search (15) → Step 3, add/edit/delete (12) → Step 4, CSV import + download (16) → Step 5, Assign/Move (10) → test & commit (5).

**The backend contract this lesson calls (student-roster endpoints).** The roster is a **new `students` entity**, keyed by `student_id` (a string like `STU001`), *separate* from the login user. Columns: `first, last, student_id (unique), email, grade (9–12), assigned_slot (display text like "Lot 7 · 7-3", or null), parking_status`. `parking_status ∈ {unassigned, valid, expired, suspended}` — whether the student holds/paid for a slot (`valid` = assigned, `suspended` = suspended, `unassigned` = none/unassigned-by-admin, `expired` = lapsed).

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
export interface Student {
  id: number; first: string; last: string; student_id: string;
  email: string; grade: string; assigned_slot: string | null;
  parking_status: "unassigned" | "valid" | "expired" | "suspended";
}

export const fetchStudents = createAsyncThunk(
  "students/fetch",
  async (q: string = "") => (await api.get(`/api/students?q=${encodeURIComponent(q)}`)) as Student[]
);

export const createStudent = createAsyncThunk(
  "students/create",
  async (body: Partial<Student>, { dispatch }) => {
    const s = (await api.post("/api/students", body)) as Student;
    await dispatch(fetchStudents());
    return s;
  }
);

export const updateStudent = createAsyncThunk(
  "students/update",
  async ({ id, patch }: { id: number; patch: Partial<Student> }, { dispatch }) => {
    const s = (await api.patch(`/api/students/${id}`, patch)) as Student;
    await dispatch(fetchStudents());
    return s;
  }
);

export const deleteStudent = createAsyncThunk(
  "students/delete",
  async (id: number, { dispatch }) => { await api.del(`/api/students/${id}`); await dispatch(fetchStudents()); return id; }
);

// Place a roster student directly into a spot (Assign or Move).
export const assignStudentToSpace = createAsyncThunk(
  "students/assign",
  async ({ id, spaceId }: { id: number; spaceId: number }, { dispatch }) => {
    await api.post(`/api/students/${id}/assign`, { spaceId });
    await dispatch(fetchStudents());
    return { id, spaceId };
  }
);
```

**Explanation:**
- Every mutating thunk ends with `dispatch(fetchStudents())` — the same **refetch-after-mutation** habit from U4/U6/U9, so the table always matches the server.
- `fetchStudents(q)` passes the search box straight to the server (`?q=`), so the *server* does the filtering — the client never holds a "full list" it has to filter itself. Simpler and it scales.
- `assignStudentToSpace` is the cross-entity piece: it doesn't create an *interest request*, it places the student directly (the server handles the "free their old spot first" move semantics).

Handle the states in `extraReducers` the usual way (`pending` → loading + clear error; `fetchStudents.fulfilled` → store `action.payload` as `list`; `rejected` → `state.error = action.error.message`). Register the slice in `store.ts`.

### Step 2 — The Students view: table + live search (~15 min)

Create `src/StudentManagement.tsx` — an admin-only pane. Reach it from the Admin Control Board with a **👥 Students** button (admin-only, same gating as ➕ Add Lot) that shows this view instead of the map, or via an `/admin/students` route if you prefer (U2 routing).

```tsx
const StudentManagement = () => {
  const dispatch = useAppDispatch();
  const list = useAppSelector((s) => s.students.list);
  const [query, setQuery] = useState("");

  useEffect(() => { dispatch(fetchStudents(query)); }, [dispatch, query]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or student ID…" />
      <table>
        <thead><tr><th>Name</th><th>Student ID</th><th>Grade</th><th>Email</th><th>Status</th><th>Slot</th><th></th></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>{s.last}, {s.first}</td><td>{s.student_id}</td><td>{s.grade}</td>
              <td>{s.email}</td><td>{s.parking_status}</td><td>{s.assigned_slot ?? "—"}</td>
              <td>{/* edit · delete · assign — Steps 3 & 5 */}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Explanation:**
- Fetching in a `useEffect` keyed on `query` is the one place a `useEffect` *is* right — it's an external-data sync, not derived state. (Contrast with the "don't set state in an effect" rule you met in U3/U8.) → [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
- The server filters via `?q=`, so typing narrows the list without any client-side filtering code.

### Step 3 — Add, edit, delete a student (~12 min)

Reuse the **modal + validated form** shape from U9's Create Lot and U6's assign modal:

- An **➕ Add Student** button opens a modal with `first`, `last`, `student_id` (all required), `email`, `grade`. On submit, `dispatch(createStudent(...))`; only close on `createStudent.fulfilled.match(res)` so a **duplicate student ID** keeps the modal open with the server's `409` message in red.
- An **Edit** action per row opens the same modal pre-filled; submit dispatches `updateStudent({ id, patch })`.
- A **Delete** action per row does a `window.confirm` then `dispatch(deleteStudent(s.id))`.

There is nothing new here — it's the exact create/validate/refetch pattern from U9, applied to a second entity. The only twist is that the identity field (`student_id`) is editable and re-checked for uniqueness on the server.

### Step 4 — CSV import and download (~16 min)

**4a — Import.** A file input + a `POST /api/students/import` as **multipart** (not JSON):

```tsx
const onImport = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const summary = await api.postForm("/api/students/import", form); // { added, updated, errors }
  await dispatch(fetchStudents(query));
  setImportSummary(summary);
};
// <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
```

Show the returned `{ added, updated, errors }` so the admin sees exactly what happened (e.g. *"Added 12, updated 3, 1 error: row 7 missing Last"*).

**4b — Download.** Build the CSV in the browser from the currently displayed list and click a temporary link:

```tsx
const downloadCsv = () => {
  const header = "First,Last,studentId,email,grade";
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;      // quote-escape every cell
  const rows = list.map((s) => [s.first, s.last, s.student_id, s.email, s.grade].map(esc).join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "students.csv"; a.click();
  URL.revokeObjectURL(url);
};
```

**Explanation:**
- Import uses `multipart/form-data` because a file isn't JSON. If your `api` client from U0 only does JSON, add a small `postForm(path, formData)` that sends the `FormData` **without** a `Content-Type` header (the browser sets the multipart boundary itself). → [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- The import **upserts by `student_id`** and reports per-row errors instead of rejecting the whole file — one typo shouldn't lose 200 good rows.
- Download quote-escapes every cell (`"` → `""`) so a name with a comma doesn't break the columns, and uses the **exact same header** as the import — that's what makes the export → edit → re-import round-trip clean. → [MDN: Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

> **Mock-storage caveat (PoC only):** the mock backend keeps everything in `localStorage`; a very large CSV can bump the ~5 MB quota. A real backend stores the roster in the database and has no such limit.

### Step 5 — Assign / Move a student to a spot (~10 min)

A per-row **Assign / Move** action (label it **Assign** when `assigned_slot` is null, **Move** otherwise). It opens a small picker: choose a **lot**, then an **available spot** in that lot (reuse `fetchLots` / `fetchSpaces` from U3), confirm, then `dispatch(assignStudentToSpace({ id, spaceId }))`.

**Explanation:**
- This is the direct-placement path U6 couldn't cover: it works for a student **with no login and no request** (the server sets `assigned_student_id`).
- The server enforces **one slot per student** — assigning a student who already holds a spot **frees the old one first** (that's why the button reads "Move"). You don't implement that on the client; you just call the endpoint and refetch.
- After it returns, the roster row flips to `parking_status: valid` and shows the new `assigned_slot` — and `DELETE /api/assignments/:spaceId` (U6's Unassign) will later clear both.

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
