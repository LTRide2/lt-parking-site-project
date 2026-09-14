# LTRide — Campus Parking Management (monorepo)

LTRide is a school parking-management system with two roles:

- **Students** register interest in a parking spot.
- **Admins** manage allocation — enable/disable spaces, assign spots, review interest, manage the roster.

This repository is a **monorepo**: the frontend, the backend, the deployment
infrastructure, and the full teaching plan all live together so a student can
build the whole system end to end from one checkout.

## What's in here

| Path | What it is |
|------|------------|
| [`frontend/`](frontend/) | Vite + React 19 + Redux Toolkit + TypeScript single-page app (the browser UI). |
| [`backend/`](backend/) | Python / Flask + PostgreSQL API (`webapp/`). Served by gunicorn in production. |
| [`deploy/`](deploy/README.md) | Infrastructure-as-Code: CloudFormation templates (`cfn/`), stack parameters (`params/`), and on-server config (`server/`). |
| [`scripts/`](scripts/) | Deployment orchestration — one entrypoint, `scripts/deploy.sh`, split into four concerns (secrets / infra / db / app). |
| [`plan/`](plan/plan.md) | The teaching plan and guides: the master design doc plus one step-by-step guide per component. |

## Where to start

- **The big picture, CR ordering, and shared contracts** → [`plan/plan.md`](plan/plan.md) (the master/orchestrator design doc).
- **Building the UI** → [`plan/ui/ui-development-guide.md`](plan/ui/ui-development-guide.md) — beginner, step-by-step (lessons U1–U…).
- **Building the server + database** → [`plan/backend/backend-development-guide.md`](plan/backend/backend-development-guide.md) — beginner, step-by-step (CRs B0–B…), including the [API reference](plan/backend/backend-development-guide.md#appendix-a--backend-api-reference-v1).
- **Going live on AWS** → [`plan/deploy/deployment-guide.md`](plan/deploy/deployment-guide.md).

Brand new? Open a component guide and follow it top to bottom; come back to
`plan/plan.md` whenever a guide says "see plan.md §X."

## Quick start (local development)

> Both `frontend/` and `backend/` are **teaching scaffolds** — you build the app up
> by following the lessons in `plan/`. As you go, run the whole stack with one
> command to check your changes end to end.

**Run everything** (Postgres + Flask API + React UI) with a single command:

```bash
scripts/local.sh up        # first run also sets up the database + dependencies
scripts/local.sh restart   # re-run after you change code
scripts/local.sh down      # stop everything
```

Then open **http://localhost:5173** (the API answers at
**http://localhost:8000/api/health**). This needs [Docker](https://www.docker.com/products/docker-desktop/)
(for Postgres), [Node 18+](https://nodejs.org/), and Python 3. Full runbook,
options, and troubleshooting: [`plan/backend/running-the-poc.md`](plan/backend/running-the-poc.md).

Prefer to run the halves separately (or set them up by hand)? The
[UI guide](plan/ui/ui-development-guide.md) and
[backend guide](plan/backend/backend-development-guide.md) are the authoritative,
step-by-step setup, and [`running-the-poc.md`](plan/backend/running-the-poc.md) §1–§8
covers the manual, native-Postgres path.

## Deploying to AWS

Everything runs through one entrypoint, `scripts/deploy.sh <concern> <subcommand>`,
in four concerns you run in order the first time:

```bash
scripts/deploy.sh secrets init   # 1. create the ltride/db + ltride/app secrets (first)
scripts/deploy.sh infra up        # 2. network → database → compute → dns (CloudFormation)
scripts/deploy.sh db migrate      # 3. apply backend/webapp/sql/migrations/*.sql
scripts/deploy.sh app all         # 4. deploy backend, then build + ship the frontend
```

`scripts/deploy.sh all` runs all four end to end; `scripts/deploy.sh destroy`
tears everything down in reverse order. Full walkthrough (AWS account setup,
DNS, HTTPS, cost model): [`plan/deploy/deployment-guide.md`](plan/deploy/deployment-guide.md)
and [`deploy/README.md`](deploy/README.md).

## License

See [`LICENSE`](LICENSE).
