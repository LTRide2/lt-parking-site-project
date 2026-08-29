# Frontend lessons — build the website one hour at a time

This folder turns the [UI Development Guide](../ui-development-guide.md) into **10 core lessons** (U0 → U9), one per CR, plus **one extension lesson** (U10) for a feature built during the PoC beyond the original plan. Each is a self-contained, ~1-hour walkthrough written for a **high-school beginner**: it states a clear deliverable, explains *why* and *how*, shows every code snippet with a plain-language explanation and a reference link, gives you a testing guide to prove it works, and ends with the exact git commands to open the CR.

> **The code you'll edit:** the frontend is its own repo — **[`github.com/LTRide2/lt-parking-site-project`](https://github.com/LTRide2/lt-parking-site-project)** (locally `~/workspace/LT_Proj/lt-parking-site-project`, branch `main`). Stack: Vite + React 19 + Redux Toolkit + TypeScript. Clone/setup is [UI guide → A3–A5](../ui-development-guide.md#a3-get-the-project-onto-your-computer). Note this is a **different repo** from the backend (`LTR-Backend`), which is where these lesson docs live.
>
> **How the lessons relate to the guide:** the guide is the reference (the "what"); each lesson is the hour-long, hand-held walkthrough (the "how + why"). A lesson never invents steps — it expands the matching CR section of the guide. When in doubt, the [guide](../ui-development-guide.md) is the source of truth.
>
> **Build the backend first (or in parallel):** several UI lessons call real API endpoints, so the matching backend CR should be running. Check the shared ordering in [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs).

## Do them in order

Each lesson **builds on the one before it** (stacked CRs — every branch starts from the previous CR's branch). Start at U0 and go down.

| # | Lesson | What you'll have built | Needs backend | Source CR |
|---|---|---|---|---|
| 1 | [U0 — Project hygiene](U0-project-hygiene.md) | A clean, linted React + TypeScript project | — | [CR U0](../ui-development-guide.md#cr-u0--project-hygiene-foundation-no-visible-change) |
| 2 | [U1 — Real login](U1-real-login.md) | A login form that calls the API and stores a JWT | B3 | [CR U1](../ui-development-guide.md#cr-u1--real-login-replaces-the-fake-login) |
| 3 | [U2 — Routing](U2-routing.md) | Real pages with URLs + protected routes | — | [CR U2](../ui-development-guide.md#cr-u2--routing-real-pages-with-urls) |
| 4 | [U3 — Show real lots and spaces](U3-show-real-lots-and-spaces.md) | A data-driven map fed by the API | B4 | [CR U3](../ui-development-guide.md#cr-u3--show-real-lots-and-spaces-data-driven-map) |
| 5 | [U4 — Make enable/disable save](U4-enable-disable-saves.md) | Admin toggles that persist via `PATCH` | B5 | [CR U4](../ui-development-guide.md#cr-u4--make-enabledisable-actually-save) |
| 6 | [U5 — Student picks a spot & registers interest](U5-student-registers-interest.md) | The student self-service map: pick a spot, submit/withdraw one request (core feature #1) | B6 | [CR U5](../ui-development-guide.md#cr-u5--student-registers-interest-core-feature-1) |
| 7 | [U6 — Admin assigns spaces](U6-admin-assigns-spaces.md) | The admin assign/unassign/move flow (core feature #2) | B7 | [CR U6](../ui-development-guide.md#cr-u6--admin-assigns-spaces-core-feature-2) |
| 8 | [U7 — Update the school map image](U7-update-school-map.md) | The real school map in place of the placeholder | — | [CR U7](../ui-development-guide.md#cr-u7--update-the-school-map-image) |
| 9 | [U8 — Place & arrange parking spots](U8-place-and-arrange-spots.md) | A drag-and-drop editor that saves each lot's spot layout | B8 | [CR U8](../ui-development-guide.md#cr-u8--place--arrange-parking-spots-drag-and-drop-layout-editor) |
| 10 | [U9 — Add (and remove) a parking lot](U9-add-a-parking-lot.md) | Admins create lots (with a lot number) and remove empty ones from the UI | B9 | [CR U9](../ui-development-guide.md#cr-u9--add-a-new-parking-lot-from-the-admin-ui) |

### Extension lessons (built during the PoC, beyond the core U0–U9)

| # | Lesson | What you'll have built | Needs backend | Notes |
|---|---|---|---|---|
| 11 | [U10 — Student Management (the roster + CSV)](U10-student-management.md) | An admin-managed student roster: CRUD, CSV import/export, and direct assign/move of a student into a spot | student-roster endpoints | See [plan.md §2](../../plan.md#2-what-we-have-in-the-ui-today) & the extensions note in [§8.2](../../plan.md#82-cr-status-tracker) |

## What each lesson contains

🎯 Goal + a "Done when" deliverable checklist · 🤔 Why it matters · 🧠 Concepts (with links) · ✅ Prereqs + a minute-by-minute time budget · 🛠 Step-by-step build (code + explanation + references) · 🧪 Testing guide · 🚀 Commit & open the CR · 🧯 Troubleshooting · 📝 Recap · 📚 References · ➡️ Next lesson.

## After the frontend

When U9 passes (U10 is optional), put the whole app online with the [**Deploy lessons**](../../deploy/lessons/D0-aws-account-setup.md). The overall order and dependencies are in [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs).
