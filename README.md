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
> by following the lessons in `plan/`. The commands below get each half running;
> the guides add the API layer, database, auth, and everything else, step by step.

**Frontend** (Vite dev server):
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

**Backend** (Flask + PostgreSQL): create the virtualenv and install dependencies,
then follow the backend guide from **CR B0** onward to add the env config
(`SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`), the schema, and the run/serve steps:
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r webapp/requirements.txt
```

The two component guides are the authoritative, step-by-step setup —
[UI guide](plan/ui/ui-development-guide.md) and
[backend guide](plan/backend/backend-development-guide.md).

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
