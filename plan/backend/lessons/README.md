# Backend lessons — build the server one hour at a time

This folder turns the [Backend Development Guide](../backend-development-guide.md) into **11 self-contained, ~1-hour lessons**: one per core CR (B0 → B9), plus one extension lesson (B13) covering the student-roster endpoints the PoC also built. Each lesson is written for a **high-school beginner**: it states a clear deliverable, shows a before → after of what the API does, explains *why* and *how*, presents every code snippet with inline comments and a short "why it works" plus reference links, gives you a testing guide to prove it works, and ends with the exact git commands to open the CR.

> **How the lessons relate to the guide:** the guide is the reference (the "what"); each lesson is the hour-long, hand-held walkthrough (the "how + why"). A lesson never invents steps — it expands the matching CR section of the guide. When in doubt, the [guide](../backend-development-guide.md) is the source of truth.

## Run it & check your changes

One script brings up the whole stack — Postgres, the Flask API, and the React UI —
so you can see your changes running end-to-end:

```bash
scripts/local.sh up        # first run also sets up the database + dependencies
scripts/local.sh restart   # re-run this after you change code
scripts/local.sh down      # stop everything
```

- **UI:** http://localhost:5173
- **API health:** http://localhost:8000/api/health
- **Seeded logins (local dev only):** `admin` / `admin123`, or student codes `STU001`–`STU004`

Full runbook and troubleshooting: [`running-the-poc.md`](../running-the-poc.md).

## Do them in order

Each lesson **builds on the one before it** (stacked CRs — every branch starts from the previous CR's branch). Start at B0 and go down.

| # | Lesson | What you'll have built | Source CR |
|---|---|---|---|
| 1 | [B0 — Clean slate & safety](B0-clean-slate-and-safety.md) | A safe repo: secrets out of the code, `.gitignore`, `requirements.txt`, `.env`/`.env.example` | [CR B0](../backend-development-guide.md#cr-b0--clean-slate--safety-do-this-first) |
| 2 | [B1 — Health check](B1-health-check.md) | A running Flask server with `GET /api/health` | [CR B1](../backend-development-guide.md#cr-b1--health-check-prove-the-server-runs) |
| 3 | [B2 — Database schema & seed data](B2-database-schema-and-seed.md) | A PostgreSQL database with tables + sample data | [CR B2](../backend-development-guide.md#cr-b2--database-schema--seed-data) |
| 4 | [B3 — Authentication (login)](B3-authentication-login.md) | Login that returns a JWT + a `@require_role` guard | [CR B3](../backend-development-guide.md#cr-b3--authentication-login) |
| 5 | [B4 — Read lots & spaces](B4-read-lots-and-spaces.md) | `GET /api/lots` and `GET /api/lots/<id>/spaces` | [CR B4](../backend-development-guide.md#cr-b4--read-lots--spaces) |
| 6 | [B5 — Admin enables/disables spaces](B5-admin-enable-disable-spaces.md) | Admin-only `PATCH /api/spaces` | [CR B5](../backend-development-guide.md#cr-b5--admin-enablesdisables-spaces) |
| 7 | [B6 — Student registers interest](B6-student-registers-interest.md) | `POST/GET /api/interest` | [CR B6](../backend-development-guide.md#cr-b6--student-registers-interest) |
| 8 | [B7 — Admin assigns a space](B7-admin-assigns-a-space.md) | `POST/DELETE /api/assignments` (a real DB transaction) | [CR B7](../backend-development-guide.md#cr-b7--admin-assigns-a-space) |
| 9 | [B8 — Save a lot's spot layout](B8-save-lot-layout.md) | `PUT /api/lots/<id>/layout` — transactional full-replace of spot positions | [CR B8](../backend-development-guide.md#cr-b8--save-lot-layout-spot-positions) |
| 10 | [B9 — Create a parking lot](B9-create-a-lot.md) | `POST /api/lots` — add a new lot (+ optional blank spaces) | [CR B9](../backend-development-guide.md#cr-b9--create-a-parking-lot) |
| 11 | [B13 — Manage the student roster](B13-manage-student-roster.md) *(extension)* | `GET/POST/PATCH/DELETE /api/students`, `POST /api/students/import` (CSV upsert), `POST /api/students/:id/assign` — the roster, separate from login users | [plan.md §8.2, CR tracker rows B13/B14](../../plan.md#82-cr-status-tracker) |

**A note on the extension rows.** The PoC validated four features beyond the core B0–B9 plan (tracker rows **B13–B16**, [plan.md §8.2](../../plan.md#82-cr-status-tracker)). Only **B13** got its own lesson above — it also covers **B14** (direct assign/move a roster student), since both live in the same `students.py` view module. The other two extensions are **folded into existing lessons** rather than split out: the preferred-spot interest + withdraw flow (**B15**) is folded into [Lesson B6 — Student registers interest](B6-student-registers-interest.md), and moving an assigned request to another lot (**B16**) is folded into [Lesson B7 — Admin assigns a space](B7-admin-assigns-a-space.md).

**Why the numbers jump from B9 to B13.** `B10`, `B11`, and `B12` aren't missing lessons — they're the planned **hardening** CRs that haven't been expanded into hour-long lessons yet: validation & error-envelope polish (**B10**), automated tests — pytest (**B11**), and a second-Postgres portability check (**B12**). They're described in [plan.md §8 Phase 4](../../plan.md#8-implementation-strategy-stacked-crs); they'll get their own lessons when scheduled.

## What each lesson contains

🎯 Goal + a "Done when" deliverable checklist · 🖼 a before → after of what the API returns · 🤔 Why it matters · 🧠 Concepts (with links) · ✅ Prereqs + a minute-by-minute time budget · 🛠 Step-by-step build (code with inline comments + a short "why it works" + references) · 🧪 Testing guide · 🚀 Commit & open the CR · 🧯 Troubleshooting · 📝 Recap · 📚 References · ➡️ Next lesson.

> **Stuck on a word?** New terms (Flask, Blueprint, JWT, ORM, CORS, …) link to the shared [**Glossary**](GLOSSARY.md) the first time each lesson uses them — one plain-language sentence per term, written for a beginner. You never have to memorize a word before the lesson needs it.

## After the backend

When B9 passes, either build the website in the [**UI lessons**](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/lessons/README.md) or put your server online with the [**Deploy lessons**](../../deploy/lessons/D0-aws-account-setup.md). The overall order and dependencies are in [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs).
