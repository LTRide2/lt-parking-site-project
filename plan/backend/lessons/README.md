# Backend lessons — build the server one hour at a time

This folder turns the [Backend Development Guide](../backend-development-guide.md) into **8 self-contained, ~1-hour lessons**, one per CR (B0 → B7). Each lesson is written for a **high-school beginner**: it states a clear deliverable, explains *why* and *how*, shows every code snippet with a plain-language explanation and a reference link, gives you a testing guide to prove it works, and ends with the exact git commands to open the CR.

> **How the lessons relate to the guide:** the guide is the reference (the "what"); each lesson is the hour-long, hand-held walkthrough (the "how + why"). A lesson never invents steps — it expands the matching CR section of the guide. When in doubt, the [guide](../backend-development-guide.md) is the source of truth.

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

## What each lesson contains

🎯 Goal + a "Done when" deliverable checklist · 🤔 Why it matters · 🧠 Concepts (with links) · ✅ Prereqs + a minute-by-minute time budget · 🛠 Step-by-step build (code + explanation + references) · 🧪 Testing guide · 🚀 Commit & open the CR · 🧯 Troubleshooting · 📝 Recap · 📚 References · ➡️ Next lesson.

## After the backend

When B7 passes, either build the website in the [**UI lessons**](../../ui/lessons/README.md) or put your server online with the [**Deploy lessons**](../../deploy/lessons/D0-aws-account-setup.md). The overall order and dependencies are in [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs).
