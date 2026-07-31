# LTRide — Parking Management Project Plan

A school parking management system with two goals:

1. **Students** register interest in a parking spot.
2. **Admins** manage parking allocation (enable/disable spaces, assign spots, review interest).

This document captures **what exists today**, the **gaps**, the **architecture (class diagrams + runtime views)**, **implementation details**, an **incremental CR-by-CR plan**, and **AWS deployment options**.

---

## 0. Start here — which document do I read?

There are **three documents** in this `plan/` folder. They work together:

| Document | What it is | Read it when |
|---|---|---|
| **`plan.md`** (this file) | The **master reference**: architecture, data model, diagrams, full API contracts, every CR listed, and the deep CloudFormation deployment detail (§10). | You want the big picture or the *precise* spec for any piece. |
| **`ui-plan.md`** | The **frontend design** (architecture view): module structure, state/routing layers, per-screen behavior — references this file for the exact API/data specs. | You want to understand *how the SPA is designed* before or while building it. |
| **`ui-development-guide.md`** | A **beginner, step-by-step guide to building the website (frontend)**, including every git command and a local test for each CR (U0–U7). | You're sitting down to write frontend code. |
| **`backend-development-guide.md`** | A **beginner, step-by-step guide to building the server + database (backend) and deploying to AWS**, with every git command and a local test for each CR (B0–B7, D1–D4). | You're sitting down to write backend code or push it live. |

**If you are brand new and just want to start building:** open `ui-development-guide.md` or `backend-development-guide.md` and follow it top to bottom. Come back to *this* file whenever a guide says "see plan.md §X" for the exact details.

**The golden rules (both guides follow them):**
1. **One CR = one small, complete change**, on its own branch named `cr/<id>-<slug>`.
2. **Each CR branches off the previous CR's branch** (stacked), so work continues while a PR is reviewed.
3. **Every PR uses the CR description template** (§8) and includes a **local testing guide**.
4. Build a backend endpoint *before* the frontend CR that depends on it (dependency map is in the backend guide).

---

## 1. Repositories

| Repo | Path | Stack | State |
|---|---|---|---|
| Frontend (UI) | `lt-parking-site-project` | Vite + React 19 + Redux Toolkit + TypeScript | UI prototype, ~45% |
| Backend | `LTR-Backend` (`github.com/LTRide2/LTR-Backend`) | Python / Flask + SQLite | Untouched course scaffold, ~5% |

**Overall completion ≈ 25%.**

> **Progress snapshot (verified against the frontend code on 2026-07-30).** The UI is still the **client-only prototype** described in §2 — no CR from the delivery plan (§8) has been started yet. The codebase confirms: **no** `react-router-dom` dependency, **no** `src/api/` client module, **no** `.env` handling, **no** `createAsyncThunk`, and **no** `fetch`/network calls anywhere in `src/`. `authSlice` is still the fake login (`loginAsStudent`/`loginAsAdmin`/`logout`); `parkingSlice` still keys spaces by string and holds a local-only `assignedSpaces` map; the store registers only `auth` + `parking`. See the **CR status board** in §8 for the per-CR breakdown.

---

## 2. What We Have in the UI (today)

> **Code-verified current as of 2026-07-30** — this section equals what is on `main` right now; none of the §8 CRs have modified it yet.

The frontend is a working **client-only prototype** — all state lives in Redux and resets on refresh. There are **no API calls and no persistence yet**.

### Implemented
- **Login screen** (`src/Login.tsx`)
  - Selection between **Student** and **Admin**.
  - Student form: enter a **code**. Admin form: username + password fields.
- **Auth state** (`src/store/authSlice.ts`): `loginAsStudent(code)`, `loginAsAdmin()`, `logout()`.
- **Control Board** (`src/ControlBoard.tsx`) — the most developed piece; it is now the shared screen **both** admins and students land on (the view changes with `userType`):
  - Campus map view ("Home") with **pan + zoom** (wheel zoom-to-cursor, drag to pan, "Reset View").
  - Lot navigation bar for **Home + Lot 1–17**.
  - **All 17 lots** now draw their own parking-space grid — sizes/shapes come from a per-lot `LOT_CONFIGS` table (sections × sides × spaces × orientation), no longer just Lot 1.
  - Three drawing modes per lot: a **plain grid**; a **map-crop overlay** (`LOT_MAP_CONFIGS`) that positions the grid on a cropped photo of the real lot; and a **curved/radial "fan" layout** (`LOT_FAN_CONFIGS`) for lots whose aisles curve. Some lots are **map-only** (`MAP_ONLY_LOTS`) — photo shown, no clickable grid yet.
  - **Edit Mode** toggle (admins only) that gates the Admin Control Board.
  - Admin control actions: **Single Select, Group Select, Disable, Enable, Manual Assign, Update School Map**. Select/enable/disable **and now Manual Assign** mutate local state (Manual Assign = pick one space → type a student ID in a modal → assign). *Update School Map* is still a no-op button.
  - **Student self-claim:** a logged-in student can click an open spot to **claim** it (a "Claim Parking Spot?" confirmation modal pops up first), is limited to **one spot at a time**, and can click their own spot again to **unclaim** it. Students see only their own spot's ID; admins see every taken spot's ID.
  - Space states: selected (yellow), disabled (grey), available (blue), **assigned/claimed (red, showing the student ID)**.
- **Parking state** (`src/store/parkingSlice.ts`): `selectedLot`, `isEditMode`, `editAction`, `selectedSpaces[]`, `disabledSpaces[]`, **`assignedSpaces` (a `{spaceId: studentId}` map)** + reducers, including `assignSpace` / `unassignSpace`.
- **Redux store** with typed hooks (`useAppDispatch`, `useAppSelector`).

### Partial / Stub
- **Student experience** — lives inside `ControlBoard` (no separate dashboard yet); a student can claim/unclaim a spot but there is no "register interest / see availability list" screen.
- **Assignment & claim are local-only** — `assignedSpaces` lives in Redux and **resets on refresh**; nothing is saved to a server.
- **Admin actions** — *Update School Map* is a button with no behavior; enable/disable/assign only mutate local state.
- **Map-only lots** — several lots (`MAP_ONLY_LOTS`) show a photo crop but have no interactive grid yet.

### Missing (UI)
Real authentication, API client layer, loading/error/empty states, routing (`react-router`), persistence, tests.

---

## 3. What We Have in the Backend (today)

`LTR-Backend` is a **generic Flask course template** (UMich "insta485" pattern), essentially unmodified for parking.

- Flask 2.2.2 + SQLite + a Webpack/React bundle served from Jinja templates.
- **Duplicated app** in two folders: `BK/` and `webapp/` (copy-paste scaffolding).
- Only DB table is a placeholder `developer (fullname, email, picture, password)`.
- `views/index.py` queries for `"John Doe"` and ignores the result.
- Returns **HTML templates, not JSON** — no REST API.
- No parking domain, no auth logic, no tests.

### 🚨 Security issues to fix first
- **`aws-tutorial.pem` (a private SSH key) is committed** — leaked secret. Remove from history **and rotate the key**.
- **`SECRET_KEY` is hard-coded** in `config.py` — move to environment variable.
- Committed `venv/`, `__pycache__/`, `.DS_Store`, `*.sqlite3` — should be gitignored.

---

## 4. Target Architecture

**Decoupled SPA + JSON API.** Frontend and backend deploy independently.

```
┌──────────────────┐      JSON / REST       ┌──────────────────┐       ┌────────────┐
│  React SPA       │  ───────────────────▶  │  Flask API       │  ───▶ │  Database  │
│  (Vite build)    │  ◀───────────────────  │  (JSON endpoints)│       │ SQLite→PG  │
└──────────────────┘                        └──────────────────┘       └────────────┘
```

- **Auth:** simple custom — students log in with a pre-issued **code**; admins with **username + password**; server issues a session/JWT token.
- **DB:** start on **SQLite**, designed so it can migrate to **PostgreSQL** for AWS.

> Open decisions (see §11) assume: **evolve Flask in place + decoupled SPA + SQLite→Postgres path + JWT**.

---

## 5. Domain / Class Diagram

### 5.1 Data model (entities)

```mermaid
classDiagram
    class User {
        +int id
        +Role role
        +string code
        +string username
        +string password_hash
        +string name
        +string email
        +datetime created_at
        +verify_password(pw) bool
    }

    class Lot {
        +int id
        +string name
        +int display_order
        +string map_image_url
        +capacity() int
        +available_count() int
    }

    class Space {
        +int id
        +int lot_id
        +string label
        +SpaceStatus status
        +int assigned_user_id
    }

    class Interest {
        +int id
        +int user_id
        +int lot_id
        +InterestStatus status
        +datetime created_at
    }

    class Assignment {
        +int id
        +int space_id
        +int user_id
        +int assigned_by
        +bool active
        +datetime created_at
    }

    User "1" --> "0..*" Interest : registers
    User "1" --> "0..*" Assignment : receives
    Lot  "1" --> "1..*" Space : contains
    Lot  "1" --> "0..*" Interest : preferred
    Space "1" --> "0..1" Assignment : currently
    Assignment "*" --> "1" User : assigned_by(admin)
```

**Enums:** `Role = {student, admin}`, `SpaceStatus = {available, disabled, assigned}`, `InterestStatus = {pending, fulfilled, declined}`.

### 5.2 Backend layering (component classes)

```mermaid
classDiagram
    class FlaskApp {
        +create_app(config) Flask
        +register_blueprints()
        +register_error_handlers()
    }
    class AuthBlueprint {
        +student_login()
        +admin_login()
        +logout()
        +me()
    }
    class LotsBlueprint {
        +list_lots()
        +get_lot_spaces(lot_id)
    }
    class SpacesBlueprint {
        +update_space(id)
        +bulk_update_spaces()
    }
    class InterestBlueprint {
        +create_interest()
        +list_interest()
        +my_interest()
    }
    class AssignmentBlueprint {
        +create_assignment()
        +delete_assignment(id)
    }
    class Repository {
        +get_db()
        +query(sql, params)
        +execute(sql, params)
    }
    class AuthService {
        +issue_token(user) str
        +verify_token(tok) User
        +require_role(role)
    }

    FlaskApp --> AuthBlueprint
    FlaskApp --> LotsBlueprint
    FlaskApp --> SpacesBlueprint
    FlaskApp --> InterestBlueprint
    FlaskApp --> AssignmentBlueprint
    AuthBlueprint --> AuthService
    SpacesBlueprint --> AuthService
    AssignmentBlueprint --> AuthService
    AuthBlueprint --> Repository
    LotsBlueprint --> Repository
    SpacesBlueprint --> Repository
    InterestBlueprint --> Repository
    AssignmentBlueprint --> Repository
```

### 5.3 Frontend module structure

```mermaid
classDiagram
    class ApiClient {
        +get(path) Promise
        +post(path, body) Promise
        +patch(path, body) Promise
        +setToken(t)
    }
    class authSlice {
        +login(thunk)
        +logout()
        +fetchMe(thunk)
    }
    class parkingSlice {
        +fetchLots(thunk)
        +fetchSpaces(thunk)
        +updateSpaces(thunk)
    }
    class interestSlice {
        +registerInterest(thunk)
        +fetchMyInterest(thunk)
    }
    class ProtectedRoute
    class LoginPage
    class StudentDashboard
    class AdminControlBoard

    authSlice --> ApiClient
    parkingSlice --> ApiClient
    interestSlice --> ApiClient
    ProtectedRoute --> authSlice
    LoginPage --> authSlice
    StudentDashboard --> interestSlice
    StudentDashboard --> parkingSlice
    AdminControlBoard --> parkingSlice
    AdminControlBoard --> interestSlice
```

---

## 6. Runtime Views (sequence diagrams)

### 6.1 Student login + register interest

```mermaid
sequenceDiagram
    actor S as Student
    participant UI as React SPA
    participant API as Flask API
    participant DB as Database

    S->>UI: enter code, submit
    UI->>API: POST /api/auth/student {code}
    API->>DB: SELECT user WHERE code=? AND role='student'
    DB-->>API: user row
    API-->>UI: 200 {token, user}
    UI->>UI: store token, route to /student

    S->>UI: view availability, click "Register Interest"
    UI->>API: POST /api/interest {lot_id} (Bearer token)
    API->>API: verify token -> student
    API->>DB: INSERT interest (pending)
    DB-->>API: ok
    API-->>UI: 201 {interest}
    UI-->>S: "Request submitted (pending)"
```

### 6.2 Admin disables spaces (bulk)

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as Control Board
    participant API as Flask API
    participant DB as Database

    A->>UI: login (username/password)
    UI->>API: POST /api/auth/admin
    API->>DB: SELECT admin, verify password_hash
    API-->>UI: 200 {token, user(admin)}

    A->>UI: Edit Mode on, Group Select spaces, Disable, Done
    UI->>API: PATCH /api/spaces {ids:[...], status:'disabled'} (Bearer)
    API->>API: require_role('admin')
    API->>DB: UPDATE spaces SET status='disabled' WHERE id IN (...)
    DB-->>API: ok
    API-->>UI: 200 {updated spaces}
    UI->>UI: optimistic update + refetch lot
```

### 6.3 Admin assigns a space to a student (allocation)

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as Control Board
    participant API as Flask API
    participant DB as Database

    A->>UI: open Interest list
    UI->>API: GET /api/interest?status=pending
    API->>DB: SELECT interest JOIN users
    API-->>UI: [pending requests]

    A->>UI: pick request, Manual Assign -> click space
    UI->>API: POST /api/assignments {space_id, user_id}
    API->>API: require_role('admin')
    API->>DB: BEGIN
    API->>DB: UPDATE spaces SET status='assigned', assigned_user_id=?
    API->>DB: INSERT assignment(active=1, assigned_by=admin)
    API->>DB: UPDATE interest SET status='fulfilled'
    API->>DB: COMMIT
    API-->>UI: 201 {assignment}
    UI-->>A: space shows assigned, request fulfilled
```

---

## 7. Implementation Details

### 7.1 Backend (Flask)

**Proposed structure (single clean app — replaces `BK/` + `webapp/`):**
```
LTR-Backend/
  app/
    __init__.py        # create_app(), CORS, blueprint + error registration
    config.py          # env-driven (SECRET_KEY, DATABASE_URL, CORS_ORIGINS)
    db.py              # get_db(), dict row factory, teardown, init-db CLI
    auth.py            # JWT issue/verify, @require_role decorator, password hashing
    blueprints/
      auth.py          # /api/auth/*
      lots.py          # /api/lots, /api/lots/<id>/spaces
      spaces.py        # PATCH /api/spaces, PATCH /api/spaces/<id>
      interest.py      # /api/interest*
      assignments.py   # /api/assignments*
  sql/
    schema.sql         # tables from §5.1
    seed.sql           # lots 1-17 + spaces + one admin
  tests/               # pytest
  bin/db, bin/run
  requirements.txt
  Dockerfile
```

**Conventions:**
- All endpoints return JSON; consistent envelope: success `{data: ...}`, error `{error: {code, message, details}}`.
- Auth: **JWT** in `Authorization: Bearer <token>`; `AuthService.issue_token` signs `{user_id, role, exp}` with `SECRET_KEY`; `@require_role('admin')` decorator guards admin routes.
- Passwords: `werkzeug.security.generate_password_hash` / `check_password_hash` (admins only; students use codes).
- DB access via thin `Repository` (parametrized SQL, `PRAGMA foreign_keys=ON`); transactions for multi-table writes (assignment flow).
- Validation: per-endpoint payload checks; reject unknown/oversized input; 400 with details.
- CORS: restrict to the SPA origin via env `CORS_ORIGINS`.

**API surface (v1):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | liveness |
| POST | `/api/auth/student` | — | login by code |
| POST | `/api/auth/admin` | — | login by username/password |
| POST | `/api/auth/logout` | any | invalidate/clear |
| GET | `/api/auth/me` | any | current user |
| GET | `/api/lots` | any | list lots |
| GET | `/api/lots/:id/spaces` | any | spaces + status |
| PATCH | `/api/spaces/:id` | admin | enable/disable one |
| PATCH | `/api/spaces` | admin | bulk enable/disable |
| POST | `/api/lots/:id/map` | admin | upload/replace map image |
| POST | `/api/interest` | student | register interest |
| GET | `/api/interest` | admin | list all interest |
| GET | `/api/interest/me` | student | own interest |
| POST | `/api/assignments` | admin | assign space → student |
| DELETE | `/api/assignments/:id` | admin | unassign |

**Request / Response contracts.** All requests/responses are `application/json`. Authenticated calls send `Authorization: Bearer <token>`. Errors use the envelope `{ "error": { "code": string, "message": string, "details"?: object } }` with the listed status codes.

#### `GET /api/health`
- **Request:** none.
- **200:** `{ "data": { "status": "ok", "time": "2026-06-29T12:00:00Z" } }`

#### `POST /api/auth/student`
- **Request:** `{ "code": "ABC123" }`
- **200:** `{ "data": { "token": "<jwt>", "user": { "id": 1, "role": "student", "name": "Jane Doe" } } }`
- **400** invalid body · **401** unknown/invalid code.

#### `POST /api/auth/admin`
- **Request:** `{ "username": "admin", "password": "secret" }`
- **200:** `{ "data": { "token": "<jwt>", "user": { "id": 9, "role": "admin", "name": "Site Admin" } } }`
- **400** invalid body · **401** bad credentials.

#### `POST /api/auth/logout`
- **Request:** none (Bearer token).
- **204:** no content.

#### `GET /api/auth/me`
- **Request:** none (Bearer token).
- **200:** `{ "data": { "id": 1, "role": "student", "name": "Jane Doe", "email": "jane@school.edu" } }`
- **401** missing/expired token.

#### `GET /api/lots`
- **Request:** none.
- **200:** `{ "data": [ { "id": 1, "name": "Lot 1", "displayOrder": 1, "mapImageUrl": "/maps/lot1.jpg", "capacity": 120, "availableCount": 37 } ] }`

#### `GET /api/lots/:id/spaces`
- **Request:** none. Path param `id` (lot id).
- **200:** `{ "data": { "lotId": 1, "spaces": [ { "id": 1001, "label": "1-0-3", "status": "available", "assignedUserId": null } ] } }`
- **404** lot not found.

#### `PATCH /api/spaces/:id` *(admin)*
- **Request:** `{ "status": "disabled" }` — `status ∈ {available, disabled}`.
- **200:** `{ "data": { "id": 1001, "label": "1-0-3", "status": "disabled", "assignedUserId": null } }`
- **400** invalid status · **403** not admin · **404** space not found · **409** space is currently assigned.

#### `PATCH /api/spaces` *(admin, bulk)*
- **Request:** `{ "ids": [1001, 1002, 1003], "status": "disabled" }`
- **200:** `{ "data": { "updated": [ { "id": 1001, "status": "disabled" }, { "id": 1002, "status": "disabled" } ], "skipped": [ { "id": 1003, "reason": "assigned" } ] } }`
- **400** invalid body · **403** not admin.

#### `POST /api/lots/:id/map` *(admin)*
- **Request:** `multipart/form-data` with field `file` (png/jpg/jpeg/gif, ≤ 16 MB).
- **201:** `{ "data": { "lotId": 1, "mapImageUrl": "/maps/lot1-<hash>.jpg" } }`
- **400** missing/invalid file · **403** not admin · **413** too large.

#### `POST /api/interest` *(student)*
- **Request:** `{ "lotId": 1 }` — `lotId` optional (preferred lot).
- **201:** `{ "data": { "id": 55, "userId": 1, "lotId": 1, "status": "pending", "createdAt": "2026-06-29T12:00:00Z" } }`
- **400** invalid body · **403** not student · **409** active request already exists.

#### `GET /api/interest` *(admin)*
- **Request:** optional query `?status=pending|fulfilled|declined`.
- **200:** `{ "data": [ { "id": 55, "user": { "id": 1, "name": "Jane Doe", "code": "ABC123" }, "lotId": 1, "status": "pending", "createdAt": "2026-06-29T12:00:00Z" } ] }`
- **403** not admin.

#### `GET /api/interest/me` *(student)*
- **Request:** none (Bearer token).
- **200:** `{ "data": [ { "id": 55, "lotId": 1, "status": "pending", "createdAt": "2026-06-29T12:00:00Z" } ] }`

#### `POST /api/assignments` *(admin)*
- **Request:** `{ "spaceId": 1001, "userId": 1 }` — optionally `{ "interestId": 55 }` to fulfill a specific request.
- **201:** `{ "data": { "id": 200, "spaceId": 1001, "userId": 1, "assignedBy": 9, "active": true, "createdAt": "2026-06-29T12:00:00Z" } }` (also sets space → `assigned` and matching interest → `fulfilled`).
- **400** invalid body · **403** not admin · **404** space/user not found · **409** space not assignable (disabled or already assigned).

#### `DELETE /api/assignments/:id` *(admin)*
- **Request:** none. Path param `id` (assignment id).
- **200:** `{ "data": { "id": 200, "active": false, "spaceId": 1001, "spaceStatus": "available" } }` (frees the space).
- **403** not admin · **404** assignment not found.

### 7.2 Frontend (React)

- **API client** (`src/api/client.ts`): fetch wrapper, base URL from `import.meta.env.VITE_API_URL`, attaches Bearer token, normalizes errors.
- **State:** convert slices to use **`createAsyncThunk`** for server calls; keep `selectedLot`/`isEditMode`/`selectedSpaces` as UI-only state. Add `interestSlice`.
- **Routing:** `react-router-dom` — `/login`, `/student`, `/admin`; `ProtectedRoute` reads `auth.token` + `role`.
- **Data-driven map:** the prototype already draws all 17 lots from a hard-coded `LOT_CONFIGS` table (with photo crops + curved/radial layouts) — replace the **space data** with spaces fetched from `/api/lots/:id/spaces`, rendering `label`/`status` from the server (keep the layout/photo code); keep existing pan/zoom for the "Home" campus map.
- **UX states:** loading spinners, empty ("No spaces available" only when truly empty), error toasts, optimistic updates with refetch on failure.

### 7.3 Cross-cutting
- **Config:** `.env` files both sides; never commit secrets.
- **Token storage:** in-memory + refresh on load via `/api/auth/me`; (optionally httpOnly cookie if Flask serves SPA).
- **Seed data:** lots 1–17, sample spaces, one admin account, a handful of student codes.

---

## 8. Incremental Delivery Plan (CRs)

Small, reviewable change requests. **B#** = backend, **U#** = frontend/UI. Ordered so each CR is shippable and unblocks the next.

Each CR lists a **Local test** — how to verify it on your machine before review. Backend assumes a venv + `flask run` (or `bin/run`) on `http://localhost:8000`; frontend assumes `npm run dev` on `http://localhost:5173` with `VITE_API_URL=http://localhost:8000`.

### CR status board (verified against code on 2026-07-30)

**Every CR below is `Not started`.** The frontend is still the §2 prototype and the backend is still the untouched scaffold — no branch from this plan has been cut. Update a row to `In progress` / `Done` (with its PR link) as work lands. Legend: ⬜ Not started · 🟡 In progress · ✅ Done.

| CR | Title | Status | Evidence / note |
|---|---|---|---|
| B0 | Repo cleanup & secret rotation | ⬜ Not started | `aws-tutorial.pem` still committed; duplicated `BK/`+`webapp/` |
| U0 | Project hygiene (router, api client, `.env`) | ⬜ Not started | no `react-router-dom` dep, no `src/api/`, no `.env` |
| B1 | App skeleton + health check | ⬜ Not started | no `create_app()` / `/api/health` |
| B2 | Schema + migrations + seed | ⬜ Not started | only placeholder `developer` table |
| B3 | Auth endpoints (JWT) | ⬜ Not started | — |
| B4 | Lots & spaces read API | ⬜ Not started | — |
| B5 | Admin space management | ⬜ Not started | — |
| B6 | Interest registration API | ⬜ Not started | — |
| B7 | Assignment API | ⬜ Not started | — |
| U1 | Real auth flow | ⬜ Not started | `authSlice` is still fake login (`userType`/`userCode`), no thunks/token |
| U2 | Routing (`react-router`) | ⬜ Not started | `App.tsx` renders `<Login />` directly; no `<BrowserRouter>` |
| U3 | Data-driven lots & spaces | ⬜ Not started | `parkingSlice` keys spaces by string; no `fetchLots`/`fetchSpaces` |
| U4 | Admin enable/disable persisted | ⬜ Not started | disable mutates local `disabledSpaces` only |
| U5 | Student interest registration | ⬜ Not started | no `interestSlice`; no `StudentDashboard` |
| U6 | Admin allocation | ⬜ Not started | Manual Assign is local-only (types a student ID) |
| U7 | Update School Map | ⬜ Not started | *Update School Map* button is a no-op |
| B8 / U8 | Validation & error handling | ⬜ Not started | — |
| B9 / U9 | Tests (pytest / Vitest) | ⬜ Not started | no test files either repo |
| B10 | Postgres migration path | ⬜ Not started | — |
| D1 | Build artifacts | ⬜ Not started | — |
| D2 | CloudFormation templates | ⬜ Not started | no `deploy/` dir |
| D3 | CI/CD | ⬜ Not started | — |
| D4 | Provision & deploy on AWS | ⬜ Not started | — |

**Prototype-only work already done (not part of the CR plan, resets on refresh):** all-17-lot rendering (`LOT_CONFIGS`/`LOT_MAP_CONFIGS`/`LOT_FAN_CONFIGS`/`MAP_ONLY_LOTS`), student claim/unclaim, local Manual Assign, edit-mode gating, pan/zoom campus map. These are the ~45% of UI counted in §1 and are the surface the U-series CRs make real.

### CR workflow & branching strategy

**Stacked branches — each CR branches off the *previous* CR's branch, not `main`.** This lets you keep building (and deploying from a branch) while an earlier CR is still in review, instead of blocking on each merge.

- Branch naming: `cr/<id>-<slug>` (e.g. `cr/b1-app-skeleton`, `cr/u1-real-auth`).
- Base each branch on the one it depends on per the build order (§9):
  ```bash
  git checkout cr/b0-cleanup            # prior CR's branch
  git checkout -b cr/b1-app-skeleton    # new CR stacks on top
  # ...work, commit, open PR with base = cr/b0-cleanup (not main)
  ```
- **Open the PR against the parent branch** so the diff shows only this CR's changes (the reviewer isn't re-shown the parent's diff).
- **Keep the stack in sync after a review:** when a parent branch changes or merges, rebase the children onto the new base so fixes flow downstream:
  ```bash
  git rebase --onto cr/b0-cleanup <old-base> cr/b1-app-skeleton
  ```
- **Merge in order.** When a parent merges to `main`, GitHub auto-retargets the child PR's base to `main`; rebase to drop the now-merged commits, then merge. Use squash-merge to keep `main` history one-commit-per-CR.
- **Deploying while waiting for review:** `deploy.sh` / `release.sh` accept any checked-out branch, so you can ship a tip-of-stack branch to a staging instance for end-to-end validation before the PRs land. Only merged `main` deploys to production (CI in CR **D3**).

Independent CRs (no data dependency) may branch directly off `main` and merge in any order — e.g. **B0** and **U0** are parallel; backend `B#` and the matching frontend `U#` are stacked only where the UI consumes that endpoint.

### CR description template (every CR uses this)

Every CR — backend and frontend — ships with a PR description in this shape. The **Local testing guide** is mandatory and expands on the one-line *Local test* summary listed per CR below.

```markdown
## <CR id> — <title>
**Depends on:** <parent CR / branch>     **Base branch:** cr/<parent>

### What & why
<1–3 sentences: the change and the user-facing/architectural reason.>

### Changes
- <file/area> — <what changed>

### Local testing guide
1. Setup: <env vars, seed/migrate commands, services to start>
2. Steps: <exact commands / clicks to exercise the change>
3. Expected: <responses, status codes, UI states — incl. error/403/404/409 paths>

### Rollback
<how to revert safely — e.g. revert PR, run down-migration>
```

> **Which CRs get the detailed description + local testing guide? All of them.** It is a standing requirement, not specific to one CR. The per-CR **Local test** lines below are the seed for each CR's "Local testing guide" section.

### Phase 0 — Hygiene & foundations
- **B0 — Repo cleanup & secret rotation.** Remove `aws-tutorial.pem` from history, rotate the key, add `.gitignore`, delete the duplicate app folder (keep one), move `SECRET_KEY` to env. *(blocks everything)*
  - **Local test:** `git log --all --oneline -- aws-tutorial.pem` returns nothing; `git ls-files | grep -E 'pem|sqlite3|__pycache__'` is empty; app still starts with `SECRET_KEY` read from env.
- **U0 — Project hygiene.** Add `.env` handling, `react-router-dom`, ESLint/Prettier baseline, and an `api/` client module. No behavior change yet.
  - **Local test:** `npm install && npm run lint && npm run build` succeed; `npm run dev` renders the existing app unchanged.

### Phase 1 — Backend API foundation
- **B1 — App skeleton + health check.** Clean `create_app()`, `GET /api/health`, CORS, env config.
  - **Local test:** `curl localhost:8000/api/health` → `{"data":{"status":"ok",...}}`; a cross-origin `fetch` from the SPA origin succeeds (no CORS error in the browser console).
- **B2 — Schema + migrations + seed.** `schema.sql` (§5.1), `bin/db` seed (lots 1–17, spaces, admin, codes), dict connection helpers.
  - **Local test:** run `./bin/db reset` (or `flask init-db`), then `sqlite3 var/App.sqlite3 ".tables"` shows all tables and `SELECT count(*) FROM lots;` = 17.
- **B3 — Auth endpoints.** `/api/auth/student|admin|logout|me`, JWT issue/verify, password hashing, `@require_role`.
  - **Local test:** `curl -XPOST localhost:8000/api/auth/student -d '{"code":"ABC123"}' -H 'Content-Type: application/json'` returns a token; reuse it on `GET /api/auth/me` → 200; a bad code → 401; admin route without token → 401.

### Phase 2 — Core parking API
- **B4 — Lots & spaces read API.** `GET /api/lots`, `GET /api/lots/:id/spaces`.
  - **Local test:** `curl localhost:8000/api/lots` lists 17 lots; `curl localhost:8000/api/lots/1/spaces` returns spaces with `status`; unknown lot id → 404.
- **B5 — Admin space management.** `PATCH /api/spaces/:id`, bulk `PATCH /api/spaces` (admin-only).
  - **Local test:** with an admin token, `PATCH /api/spaces/1001 {"status":"disabled"}` → 200 and re-GET shows `disabled`; same call with a student token → 403; bulk PATCH returns `updated`/`skipped`.
- **B6 — Interest registration API.** `POST /api/interest`, `GET /api/interest`, `GET /api/interest/me`.
  - **Local test:** student token `POST /api/interest {"lotId":1}` → 201 `pending`; `GET /api/interest/me` shows it; admin `GET /api/interest?status=pending` lists it; duplicate active request → 409.
- **B7 — Assignment API.** `POST /api/assignments`, `DELETE /api/assignments/:id`, mark interest fulfilled (transactional, per §6.3).
  - **Local test:** admin `POST /api/assignments {"spaceId":1001,"userId":1,"interestId":55}` → 201; verify space is now `assigned` and interest `fulfilled`; assigning an already-assigned space → 409; `DELETE` frees the space (`available`).

### Phase 3 — Wire the UI to the API
- **U1 — Real auth flow.** Replace fake login with B3; token storage, auth guard, real logout, error states.
  - **Local test:** with backend running, log in as student with a seeded code → lands on dashboard; wrong code shows an error; refresh keeps you logged in (`/me`); logout returns to login; visiting `/admin` while logged out redirects.
- **U2 — Routing.** `react-router`; remove manual view switching.
  - **Local test:** `/login`, `/student`, `/admin` are directly navigable; back/forward buttons work; deep-linking to a protected route while logged out redirects to `/login`.
- **U3 — Data-driven lots & spaces.** Fetch from B4; render any lot's grid from data.
  - **Local test:** switching lots in the nav renders each lot's real grid (not just Lot 1) from the API; space colors reflect server `status`; loading + error states show when the API is slow/down.
- **U4 — Admin enable/disable persisted.** Connect Disable/Enable/Group Select to B5; optimistic update + refetch.
  - **Local test:** disable spaces as admin, **refresh the page** → they remain disabled (persisted); a forced API failure rolls back the optimistic update.
- **U5 — Student interest registration.** Real student dashboard: view availability, register interest (B6), see status.
  - **Local test:** as a student, register interest → status shows `pending`; the same request appears in the admin's interest list; re-registering is blocked/handled.
- **U6 — Admin allocation.** Implement *Manual Assign* against B7; interest list + assign; reflect assigned state on the map.
  - **Local test:** admin opens interest list, assigns a space to a student → space shows `assigned` on the map and the request flips to `fulfilled`; the assigned student sees their spot.
- **U7 — Update School Map.** Admin uploads/replaces a lot's map image (`POST /api/lots/:id/map`).
  - **Local test:** upload a PNG/JPG for a lot → the new image renders after refresh; a non-image or >16 MB file is rejected with a visible error.

### Phase 4 — Hardening
- **B8 / U8 — Validation & error handling.** Server validation, consistent error envelope, UI toasts/empty/loading states.
  - **Local test:** malformed/oversized payloads return 400 with the `{error:{code,message}}` envelope; the UI surfaces a toast instead of crashing; empty lists show an empty state.
- **B9 / U9 — Tests.** Backend: pytest (API + auth). Frontend: Vitest + Testing Library.
  - **Local test:** `pytest` is green (auth + each endpoint, incl. 401/403/409 paths); `npm run test` green for login, routing guard, and interest/assign flows.
- **B10 — Postgres migration path** (run schema on Postgres; swap connection layer via `DATABASE_URL`).
  - **Local test:** run a local Postgres (e.g. `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres`), point `DATABASE_URL` at it, run `schema.sql`+`seed.sql`, and re-run `pytest` green against Postgres.

### Phase 5 — Deployment (EC2 + RDS via CloudFormation, see §10)
- **D1 — Build artifacts.** Production gunicorn config + `requirements.txt` pinned; frontend `npm run build` produces `dist/`.
  - **Local test:** `gunicorn "app:create_app()" --bind 127.0.0.1:8000` serves the API; `npm run build && npm run preview` serves the SPA hitting the local API.
- **D2 — CloudFormation templates** (`deploy/cfn/01-network, 02-database, 03-compute, 04-dns`) + `deploy.sh` + `params/prod.json`.
  - **Local test:** `aws cloudformation validate-template --template-body file://deploy/cfn/01-network.yaml` (etc.) passes for every template; `cfn-lint deploy/cfn/*.yaml` is clean; a `create-change-set` previews the expected resources without erroring.
- **D3 — CI/CD** (GitHub Actions): lint/test/build, then `cloudformation deploy` for infra + SSH/rsync for app artifacts.
  - **Local test:** run the workflow with `act` (or on a branch) and confirm lint/test/build/validate-template stages pass before any deploy step.
- **D4 — Provision & deploy on AWS** (deploy the four stacks per §10.2–10.9).
  - **Local test:** `curl http://<elastic-ip>/api/health` → ok; the SPA loads over the public IP and logs in against RDS-backed data; `https://<your-domain>/api/health` returns 200 with a valid cert; `detect-stack-drift` reports no drift.

---

## 9. Suggested Build Order (critical path)

```
B0 → B1 → B2 → B3 → U0/U1/U2  →  B4 → U3  →  B5 → U4  →  B6 → U5  →  B7 → U6  →  U7
                                                   → (Phase 4 hardening) → (Phase 5 deploy)
```

Demoable after **U5** (students register interest, admins manage spaces); feature-complete after **U7**.

---

## 10. AWS Deployment — EC2 + RDS via CloudFormation

**Architecture:** Flask served by **gunicorn** behind **nginx** on a single **EC2** instance; **PostgreSQL on RDS**; the React static bundle served from the same nginx (simplest) or from **S3 + CloudFront**. HTTPS via **Let's Encrypt (certbot)** on a domain managed in **Route 53**. **All infrastructure is provisioned and managed with AWS CloudFormation (IaC)** — no manual console clicks for the resources below.

```
                 ┌──────── EC2 c6g.4xlarge (Ubuntu 22.04, arm64) ──────┐
 Internet ──443──┤ nginx (TLS, reverse proxy, serves React build)      │
   (Route 53)    │   │                                                  │
                 │   └─ proxy /api ─▶ gunicorn (systemd) ─▶ Flask app   │
                 └───────────────────────────┬──────────────────────────┘
                                              │ 5432 (private SG)
                                     ┌────────▼─────────┐
                                     │ RDS PostgreSQL   │
                                     └──────────────────┘
```

### 10.1 Prerequisites
- AWS account with admin/IAM access; AWS CLI configured locally (`aws configure`).
- A registered domain with a **Route 53 hosted zone** (note its `HostedZoneId`).
- Backend prepared per CRs **B0–B10** (B10 = Postgres-ready connection layer).
- A fresh EC2 **key pair** created once (`aws ec2 create-key-pair`), referenced by name as a stack parameter (**not** the leaked `aws-tutorial.pem`).
- The RDS master password stored in **AWS Secrets Manager** (CloudFormation references it dynamically; it is never written into the template or git).

### 10.2 IaC layout
Keep deployment code in the repo under `deploy/`, split into composable nested/standalone stacks so they can be updated independently:
```
deploy/
  cfn/
    01-network.yaml     # VPC, 2 public + 2 private subnets, IGW, route tables, SGs
    02-database.yaml    # RDS PostgreSQL, DB subnet group, Secrets Manager secret
    03-compute.yaml     # EC2 + Elastic IP + IAM instance role, UserData bootstrap
    04-dns.yaml         # Route 53 A record → Elastic IP
  params/
    prod.json           # stack parameters (instance type, domain, key name, ...)
  deploy.sh             # wrapper: aws cloudformation deploy for each stack in order
```
Rather than typing four `aws cloudformation deploy` commands, **`deploy/deploy.sh` wraps them all** — it validates every template, then creates/updates the stacks in dependency order, adds `CAPABILITY_NAMED_IAM` only where needed, and prints the stack outputs:
```bash
./deploy/deploy.sh up        # validate + create/update all stacks (env defaults to prod)
./deploy/deploy.sh validate  # validate templates only, no changes
./deploy/deploy.sh status    # show each stack's status
./deploy/deploy.sh outputs   # print each stack's Outputs
./deploy/deploy.sh down      # delete all stacks in reverse order (DB leaves a final snapshot)
```
Region/profile come from `AWS_REGION` / `AWS_PROFILE`; stack parameters live in `deploy/params/<env>.json` (e.g. `AdminCidr`, `KeyName`, `DomainName`, `HostedZoneId`). Cross-stack wiring uses `Outputs` + `Fn::ImportValue` (e.g. network exports `VpcId`, `WebSubnetId`, `WebSecurityGroupId`, `DbSecurityGroupId`; database exports the RDS endpoint).

The script is self-bootstrapping: a `preflight` step checks for the AWS CLI and **only installs it (via `brew install awscli`) if it is missing on macOS** — an existing AWS CLI is detected and left untouched. It also verifies credentials (`sts get-caller-identity`) before making any changes.

### 10.3 Network stack (`01-network.yaml`)
Provisions: a VPC (`10.0.0.0/16`), two public subnets + two private subnets across two AZs, an Internet Gateway + public route table, and two security groups:
- **`WebSecurityGroup`** (EC2): inbound `443` and `80` from `0.0.0.0/0`, `22` from a parameterized `AdminCidr` (your IP).
- **`DbSecurityGroup`** (RDS): inbound `5432` whose `SourceSecurityGroupId` = `WebSecurityGroup` (not a CIDR). No public ingress.

```yaml
  DbSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: RDS access from web tier only
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref WebSecurityGroup
```

### 10.4 Database stack (`02-database.yaml`)
Provisions a **Secrets Manager** secret (auto-generated password), a DB subnet group across the two private subnets, and the RDS instance. `MasterUserPassword` is resolved from the secret at deploy time — never in plaintext.

```yaml
  DbSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: ltride/rds/master
      GenerateSecretString:
        SecretStringTemplate: '{"username":"ltride_admin"}'
        GenerateStringKey: password
        ExcludePunctuation: true
        PasswordLength: 32

  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    Properties:
      Engine: postgres
      DBInstanceClass: !Ref DbInstanceClass     # db.t3.micro (free tier)
      AllocatedStorage: "20"
      DBName: ltride
      MasterUsername: ltride_admin
      MasterUserPassword: !Sub '{{resolve:secretsmanager:${DbSecret}:SecretString:password}}'
      DBSubnetGroupName: !Ref DbSubnetGroup
      VPCSecurityGroups: [ !ImportValue ltride-network-DbSecurityGroupId ]
      PubliclyAccessible: false
      BackupRetentionPeriod: 7
      MultiAZ: false
    # Outputs: DB endpoint address + the secret ARN (consumed by compute UserData)
```

### 10.5 Compute stack (`03-compute.yaml`) — EC2 + bootstrap
Provisions an Elastic IP, an IAM instance role (read the DB secret + write CloudWatch logs), and the EC2 instance whose **`UserData`** bootstraps the server on first boot — so the box is reproducible from the template, not hand-configured. UserData performs the same steps that were previously manual:

```yaml
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref UbuntuAmiId          # SSM-resolved Ubuntu 22.04 AMI (arm64 — c6g is Graviton2)
      InstanceType: !Ref WebInstanceType  # c6g.4xlarge (16 vCPU, 32 GiB, arm64/Graviton2)
      KeyName: !Ref KeyName
      IamInstanceProfile: !Ref WebInstanceProfile
      SubnetId: !ImportValue ltride-network-PublicSubnet1Id
      SecurityGroupIds: [ !ImportValue ltride-network-WebSecurityGroupId ]
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash -xe
          apt update && apt install -y python3-venv nginx postgresql-client git jq awscli
          useradd -m -s /bin/bash ltride
          sudo -u ltride git clone https://github.com/LTRide2/LTR-Backend.git /home/ltride/app
          cd /home/ltride/app
          sudo -u ltride python3 -m venv .venv
          sudo -u ltride .venv/bin/pip install -r requirements.txt gunicorn psycopg2-binary
          # Pull DB creds from Secrets Manager and write the env file
          SECRET=$(aws secretsmanager get-secret-value --secret-id ltride/rds/master --query SecretString --output text --region ${AWS::Region})
          PW=$(echo "$SECRET" | jq -r .password)
          cat >/home/ltride/app/.env <<ENV
          FLASK_ENV=production
          SECRET_KEY=$(openssl rand -hex 32)
          DATABASE_URL=postgresql://ltride_admin:$PW@${DbEndpoint}:5432/ltride
          CORS_ORIGINS=https://${DomainName}
          ENV
          chmod 600 /home/ltride/app/.env && chown ltride:ltride /home/ltride/app/.env
          # Initialize schema + seed, then install services (see 10.6–10.9)
          sudo -u ltride bash -c 'set -a; . .env; psql "$DATABASE_URL" -f sql/schema.sql -f sql/seed.sql'
          # ... systemd unit + nginx config installed here (10.6/10.8) ...
```

`DbEndpoint` and `DomainName` are passed in as parameters from the database/DNS stack outputs. The instance role grants `secretsmanager:GetSecretValue` on `ltride/rds/master` only.

### 10.6 gunicorn as a systemd service
The UserData (10.5) writes this unit. It is shown standalone for clarity / manual ops:
`/etc/systemd/system/ltride.service`:
```ini
[Unit]
Description=LTRide Flask API
After=network.target

[Service]
User=ltride
Group=www-data
WorkingDirectory=/home/ltride/app
EnvironmentFile=/home/ltride/app/.env
ExecStart=/home/ltride/app/.venv/bin/gunicorn \
    --workers 3 --bind 127.0.0.1:8000 "app:create_app()"
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ltride
sudo systemctl status ltride        # verify active (running)
curl http://127.0.0.1:8000/api/health
```

### 10.7 Build & place the frontend
The SPA build is an app artifact, not infrastructure, so it stays a CI step. On your machine (or in CI): `VITE_API_URL=https://<your-domain> npm run build` → produces `dist/`. Copy it to the server:
```bash
rsync -avz -e "ssh -i ltride-key.pem" dist/ ubuntu@<elastic-ip>:/tmp/dist/
sudo mkdir -p /var/www/ltride && sudo cp -r /tmp/dist/* /var/www/ltride/
```
*(Alternative: a separate CloudFormation stack provisions an S3 bucket + CloudFront distribution; CI syncs `dist/` to S3 and invalidates the cache. nginx then only proxies `/api`.)*

### 10.8 nginx reverse proxy + SPA
`/etc/nginx/sites-available/ltride`:
```nginx
server {
    listen 80;
    server_name <your-domain>;

    root /var/www/ltride;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;   # SPA client-side routing
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/ltride /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 10.9 DNS + HTTPS
- **DNS** is managed by the **DNS stack (`04-dns.yaml`)**: an `AWS::Route53::RecordSet` (A record) in the hosted zone pointing at the Elastic IP exported by the compute stack.
```yaml
  ApiRecord:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: !Ref HostedZoneId
      Name: !Ref DomainName
      Type: A
      TTL: "300"
      ResourceRecords: [ !ImportValue ltride-compute-ElasticIp ]
```
- **TLS** is obtained on the box via certbot (one-time, can run from UserData after DNS resolves):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain> --non-interactive --agree-tos -m admin@<your-domain>
sudo systemctl status certbot.timer   # auto-renewal enabled
```
*(For fully-managed certs without certbot, front the instance with an ALB + ACM certificate in a future stack revision.)*

### 10.10 Deploy / update workflow
**Infrastructure changes** go through CloudFormation only — edit the template, preview a change set, then apply:
```bash
aws cloudformation deploy --stack-name ltride-compute --template-file deploy/cfn/03-compute.yaml \
  --parameter-overrides file://deploy/params/prod.json --capabilities CAPABILITY_NAMED_IAM
# inspect drift any time:
aws cloudformation detect-stack-drift --stack-name ltride-compute
```
**Application changes** (code, not infra) are shipped with **`deploy/release.sh`**, which resolves the EC2 host from the compute stack outputs and deploys both tiers over SSH:
```bash
./deploy/release.sh all        # deploy backend then frontend (env defaults to prod)
./deploy/release.sh backend    # backend only: git pull + pip install + DB migrate + restart gunicorn
./deploy/release.sh frontend   # frontend only: npm build (prod VITE_API_URL) + rsync dist/ to nginx
```
It reads the SSH key from `~/.ssh/<KeyName>.pem` (override with `SSH_KEY`), builds the UI from `UI_DIR` (default `../lt-parking-site-project`) pointing at `https://<DomainName>`, runs backend migrations, restarts gunicorn, and verifies `/api/health` before finishing.

The equivalent **manual steps** (useful for debugging on the box) remain:
```bash
# backend — on the server, as ltride
cd ~/app && git pull
. .venv/bin/activate && pip install -r requirements.txt
psql "$DATABASE_URL" -f sql/migrations/<new>.sql   # if schema changed
sudo systemctl restart ltride
# frontend — rebuild locally, rsync dist/ (or S3 sync), no service restart needed
```
**CI/CD (CR D2):** a GitHub Actions workflow on push to `main` runs `cloudformation deploy` for infra changes, then calls `release.sh` to deploy the application code.

### 10.11 Operations & hardening
- **Backups:** RDS `BackupRetentionPeriod: 7` is set in the template; `DeletionPolicy: Snapshot` prevents data loss if the DB stack is deleted.
- **Logs:** `journalctl -u ltride -f` (app), `/var/log/nginx/` (web). The instance IAM role permits shipping to CloudWatch Logs via the agent (installed in UserData).
- **Monitoring:** add `AWS::CloudWatch::Alarm` resources (EC2 CPU, RDS free storage/connections) to the relevant stacks so alarms are version-controlled too.
- **Security:** SSH (`22`) restricted to `AdminCidr` in the template; secrets live only in Secrets Manager; `.env` is generated on-box (never in git); run `unattended-upgrades`.
- **Teardown:** `aws cloudformation delete-stack` in reverse order (dns → compute → database → network) cleanly removes everything (DB leaves a final snapshot).
- **Cost:** the web tier runs on **c6g.4xlarge** (16 vCPU / 32 GiB, Graviton2) — **not** free-tier; see the full monthly estimate in §10.13. RDS stays on `db.t3.micro`. Elastic IP is free while associated with a running instance.

### 10.12 Deployment diagram — all AWS services

Every AWS resource the plan provisions, grouped by CloudFormation stack. Solid arrows are the request/data path; dashed arrows are provisioning/read-at-deploy dependencies. The **S3 + CloudFront** path is the optional alternative to nginx-served static files (§10.7).

```mermaid
flowchart TB
    user([Student / Admin browser])

    subgraph AWS["AWS Account (region)"]
        cfn[["CloudFormation<br/>(IaC — provisions all stacks)"]]

        subgraph dnsStack["04-dns stack"]
            r53["Route 53<br/>Hosted Zone + A record"]
        end

        subgraph optCDN["Optional frontend path (S3 + CloudFront)"]
            cf["CloudFront<br/>distribution"]
            s3["S3 bucket<br/>(React dist/ build)"]
        end

        subgraph vpc["01-network stack — VPC 10.0.0.0/16"]
            igw["Internet Gateway"]

            subgraph pub["Public subnets (2 AZs)"]
                eip["Elastic IP"]
                subgraph ec2box["03-compute stack — EC2 c6g.4xlarge<br/>(Ubuntu 22.04, arm64/Graviton2)"]
                    nginx["nginx<br/>(TLS via certbot, reverse proxy,<br/>serves React build)"]
                    gunicorn["gunicorn + Flask API<br/>(systemd service)"]
                end
            end

            subgraph priv["Private subnets (2 AZs)"]
                rds[("02-database stack<br/>RDS PostgreSQL<br/>db.t3.micro")]
            end

            websg{{"WebSecurityGroup<br/>80/443 from 0.0.0.0/0<br/>22 from AdminCidr"}}
            dbsg{{"DbSecurityGroup<br/>5432 from WebSecurityGroup only"}}
        end

        secrets["Secrets Manager<br/>ltride/rds/master"]
        iamrole["IAM instance role<br/>+ instance profile"]
        cwlogs["CloudWatch Logs<br/>(+ optional Alarms)"]
    end

    user -->|HTTPS 443| r53
    r53 --> eip
    eip --> igw
    igw --> nginx
    nginx -->|proxy /api| gunicorn
    gunicorn -->|5432| rds

    user -.->|static assets<br/>optional| cf
    cf --> s3

    websg -.->|guards| ec2box
    dbsg -.->|guards| rds
    ec2box -->|assumes| iamrole
    iamrole -->|GetSecretValue| secrets
    gunicorn -.->|reads DB creds at boot| secrets
    ec2box -->|ships logs| cwlogs
    rds -.->|master password| secrets

    cfn -.->|provisions| vpc
    cfn -.->|provisions| dnsStack
    cfn -.->|provisions| ec2box
    cfn -.->|provisions| rds
    cfn -.->|provisions| secrets
```

**AWS services inventory**

| Service | Stack | Role in the system |
|---|---|---|
| CloudFormation | (all) | IaC engine that provisions/updates every resource below |
| VPC, subnets, Internet Gateway, route tables | `01-network` | Network isolation: 2 public + 2 private subnets across 2 AZs |
| Security Groups (Web, Db) | `01-network` | Firewall: web tier open on 80/443 (22 from AdminCidr); DB reachable only from the web SG |
| EC2 (c6g.4xlarge, 16 vCPU/32 GiB, Ubuntu 22.04 arm64) | `03-compute` | Runs nginx + gunicorn/Flask; bootstrapped via UserData |
| Elastic IP | `03-compute` | Stable public address bound to the EC2 instance |
| IAM role + instance profile | `03-compute` | Grants EC2 `secretsmanager:GetSecretValue` + CloudWatch Logs write |
| RDS PostgreSQL (db.t3.micro) | `02-database` | Managed database in private subnets; 7-day backups, Snapshot on delete |
| Secrets Manager | `02-database` | Auto-generated RDS master password; read by EC2 at boot |
| Route 53 | `04-dns` | Hosted zone + A record → Elastic IP |
| CloudWatch Logs (+ Alarms) | `03-compute` / ops | App/web log shipping; optional EC2/RDS alarms |
| S3 + CloudFront *(optional)* | future stack | Alternative static hosting for the React build instead of nginx |

### 10.13 Monthly cost estimate (c6g.4xlarge)

**Assumptions:** region **us-east-1**, **on-demand** list prices, **730 hrs/month** (24×7), single-AZ RDS. Prices are AWS list rates and exclude taxes; actual bills vary by region, usage, and any Savings Plans/Reserved Instances.

> ⚠️ **This overrides the free-tier cost note in §10.11.** The plan's baseline assumed `t3.micro` (free tier); switching the web tier to **c6g.4xlarge** (16 vCPU / 32 GiB, Graviton2) makes EC2 the dominant cost — this is **not** a free-tier configuration.

| Line item | Spec | Unit price | Qty / month | Monthly cost |
|---|---|---|---|---|
| EC2 web server | c6g.4xlarge (16 vCPU, 32 GiB) | $0.544 / hr | 730 hrs | **$397.12** |
| EC2 root volume | EBS gp3, ~30 GB (assumed) | $0.08 / GB-mo | 30 GB | $2.40 |
| RDS instance | db.t3.micro PostgreSQL, single-AZ | $0.017 / hr | 730 hrs | $12.41 |
| RDS storage | gp2, 20 GB | $0.115 / GB-mo | 20 GB | $2.30 |
| RDS backups | 7-day retention (≤ DB size) | included | — | ~$0.00 |
| Secrets Manager | 1 secret (`ltride/rds/master`) | $0.40 / secret-mo | 1 | $0.40 |
| Route 53 | 1 hosted zone | $0.50 / zone-mo | 1 | $0.50 |
| CloudWatch Logs | low-volume app/web logs (est.) | $0.50 / GB ingest | ~1–2 GB | ~$1.00 |
| Elastic IP | attached to running instance | free while attached | 1 | $0.00 |
| Data transfer out | first 100 GB/mo free | $0.09 / GB after | < 100 GB | $0.00 |
| Domain registration | `.com` via Route 53, ~$13/yr amortized | $13 / yr | 1/12 | $1.08 |
| **Total** | | | | **≈ $417.21 / month** |

*(The table above is the **mid**-range scenario as specced: c6g.4xlarge on-demand + single-AZ db.t3.micro.)*

#### Minimum / mid / maximum monthly scenarios — sized for ~1000 concurrent users

**Load assumption: ~1000 concurrent users.** This is real production traffic, and it changes what each tier means: the total swings mostly with **EC2 size + count**, **RDS tier + HA**, **egress traffic** (1000 users pull real data), and whether a **load balancer** fronts the app. Three planning scenarios (all us-east-1, on-demand unless noted, 730 hrs/mo):

| Cost driver | **Minimum** (demo only) | **Mid** (as specced, sized for load) | **Maximum** (HA production) |
|---|---|---|---|
| Load balancer (ALB) | — (none) | — (single instance, specced) | ALB + LCUs — $22.00 |
| EC2 web tier | t4g.small (2 vCPU/2 GiB) — $12.26 | **c6g.4xlarge (16 vCPU/32 GiB) — $397.12** | 2× c6g.4xlarge — $794.24 |
| EC2 root volume | gp3 20 GB — $1.60 | gp3 30 GB — $2.40 | 2× gp3 30 GB — $4.80 |
| RDS instance | db.t3.micro single-AZ — $12.41 | db.t3.medium single-AZ — $49.64 | db.t3.large Multi-AZ — $198.56 |
| RDS storage | gp2 20 GB — $2.30 | gp2 50 GB — $5.75 | gp2 100 GB — $11.50 |
| Secrets Manager | $0.40 | $0.40 | $0.40 |
| Route 53 (zone + queries) | $0.50 | $1.00 | $2.00 |
| CloudWatch Logs (+ Alarms) | $0.50 | $5.00 | $15.00 |
| S3 + CloudFront (frontend) | — (nginx-served) | — (nginx-served) | ~$10.00 |
| Data transfer out | $0.00 (demo, < 100 GB free) | ~$18.00 (≈300 GB) | ~$70.00 (≈900 GB, via CloudFront) |
| Domain registration (amortized) | $1.08 | $1.08 | $1.08 |
| **AWS monthly total** | **≈ $31.05** | **≈ $480.39** | **≈ $1,127.58** |

**Why each tier costs what it does:**

- **Minimum — ≈ $31/mo (DEMO ONLY, does *not* serve 1000 concurrent users).** This is the cheapest way to stand the system up: a single small `t4g.small` instance, a free-tier-class `db.t3.micro`, nginx serving the static files, and near-zero traffic (under the 100 GB/mo free egress). It is deliberately under-provisioned — a `t4g.small` and a `db.t3.micro` would saturate CPU and exhaust DB connections well before 1000 concurrent users, and with a single instance any reboot is downtime. **Use this figure only for a demo, dev, or class-presentation environment, not for the stated 1000-user load.** It's included as the floor so you can see how cheaply the stack runs when it isn't carrying real traffic.

- **Mid — ≈ $480/mo (the specced architecture, sized to actually carry 1000 users).** This is the plan's single `c6g.4xlarge` (16 vCPU / 32 GiB) — its 16 cores run enough gunicorn workers to handle 1000 concurrent users of a lightweight API, and EC2 is by far the dominant line ($397). The DB is bumped from `db.t3.micro` to **`db.t3.medium`** because a micro can't hold the connection pool 1000 users generate. Real egress (~300 GB) now costs ~$18 since the free 100 GB is exceeded, and logging rises with traffic. The trade-off: **one instance = one point of failure** — a crash or reboot is an outage until it restarts.

- **Maximum — ≈ $1,128/mo (highly-available production).** This removes the single point of failure and adds headroom: an **ALB** spreads traffic across **two `c6g.4xlarge` instances** (so one can fail or be redeployed with no downtime), and RDS moves to a **Multi-AZ `db.t3.large`** with a hot standby in a second AZ. Static assets move to **S3 + CloudFront** (cheaper, faster egress at scale), egress rises to ~900 GB (~$70), and CloudWatch alarms/logs are fully on. This is what you'd run if the parking system were business-critical during a rush (e.g. start-of-semester).

> **Reserved capacity discount:** committing the `c6g.4xlarge` fleet to a **1-year Compute Savings Plan** (~$0.34/hr vs $0.544 on-demand) cuts each instance ~37% — bringing **mid ≈ $332** and **max ≈ $832**.

**Cost-reduction levers:**
- **c6g.4xlarge is likely oversized** for this workload (a small Flask API); a `t3.micro`/`t4g.small` would drop the EC2 line to single-digit dollars. Size it to measured load.
- A **1-year Compute Savings Plan / Reserved Instance** cuts the EC2 rate ~30–60% (≈ $160–280/mo for the c6g.4xlarge line).
- Optional **S3 + CloudFront** frontend hosting (§10.7) adds a few dollars/month but offloads static traffic from EC2.

### 10.14 Actual professional costs (contractor build + maintenance)

The AWS figures above (§10.13) are **infrastructure only**. This section estimates the **professional software engineering cost** to actually build, deliver, and maintain the system — labor, not cloud bills.

**Assumptions:** US-based independent contractor / small agency, **blended rate $125/hr** (mid–senior full-stack; typical market range $100–160/hr). Effort is scoped from the CR plan in §8 (B0–B10, U0–U9, D1–D4). One-time build is a project fee; maintenance is an ongoing monthly retainer **separate from AWS costs**.

#### One-time build cost

| Work package | Scope (CRs) | Est. hours | Cost @ $125/hr |
|---|---|---|---|
| Hygiene & foundations | B0, U0 (secret rotation, cleanup, tooling) | 20 | $2,500 |
| Backend API | B1–B7 (skeleton, schema/seed, auth, lots/spaces, interest, assignments) | 80 | $10,000 |
| Frontend wiring | U1–U7 (auth, routing, data-driven map, admin/student flows, map upload) | 90 | $11,250 |
| Hardening | B8/U8, B9/U9, B10 (validation, tests, Postgres migration) | 50 | $6,250 |
| Deployment / IaC | D1–D4 (gunicorn, CloudFormation stacks, CI/CD, provisioning) | 40 | $5,000 |
| PM, QA, code review, docs | cross-cutting (~15% overhead) | 30 | $3,750 |
| **Total one-time build** | | **310 hrs** | **≈ $38,750** |

> Typical delivery range **$30k–$50k** depending on rate, scope creep, and how much of the existing UI prototype is reused vs. rebuilt.

#### Monthly maintenance (retainer, separate from AWS)

Ongoing engineering support after launch — bug fixes, security patching, dependency upgrades, small feature requests, and monitoring/on-call. Priced as a retainer, independent of the AWS bill in §10.13.

| Maintenance item | Basis | Monthly cost |
|---|---|---|
| Support & bug fixes | ~8 hrs/mo @ $125/hr | $1,000 |
| Security & dependency patching | ~2 hrs/mo @ $125/hr | $250 |
| Monitoring / on-call availability | flat standby fee | $500 |
| Minor enhancements | ~2 hrs/mo @ $125/hr | $250 |
| **Total monthly maintenance (labor)** | ~12 hrs/mo | **≈ $2,000 / month** |

#### Combined monthly run-rate

| Component | Monthly cost |
|---|---|
| AWS infrastructure (§10.13, mid tier sized for 1000 users, incl. domain) | ≈ $480 |
| Professional maintenance (labor, above) | ≈ $2,000 |
| **Total monthly run-rate** | **≈ $2,480 / month** |

> **Year-one total of ownership** (one-time build + 12× combined run-rate) ≈ **$38,750 + $29,760 ≈ $68,510**. These are planning estimates at a $125/hr blended rate and the mid AWS tier — adjust for the actual contractor rate, region, chosen AWS tier, and negotiated scope.

---

## 11. Open Decisions to Confirm
1. **Backend base:** evolve `webapp/` in place vs clean Flask rebuild vs switch (FastAPI / Node). *(plan assumes evolve/clean Flask)*
2. **Frontend–backend coupling:** decoupled SPA + JSON API (assumed) vs Flask serves the React build.
3. **Database:** stay on SQLite for local dev with a Postgres-ready layer (assumed) — the EC2 + RDS deploy in §10 runs on PostgreSQL.
4. **Auth token:** JWT (assumed) vs session cookie.
