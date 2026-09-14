# `deploy/` — Deployment home

This folder is the **home for all deployment artifacts** for LTRide: the Infrastructure-as-Code
templates, the stack parameters, and the on-server config files. The runnable orchestration lives
one level up in [`scripts/`](../scripts/) — a single credential-checked entrypoint,
`scripts/deploy.sh`, split into **four concerns**.

> **Docs live in the deployment guide, not here.** The authoritative deployment documentation is in
> [`plan/deploy/deployment-guide.md`](../plan/deploy/deployment-guide.md):
> - **Step-by-step tutorial** → [Part 1 — Deploy to AWS (CRs D0–D4)](../plan/deploy/deployment-guide.md#part-1--deploy-to-aws-step-by-step-crs-d0d4)
> - **Operating & troubleshooting the live server** → [Part 2](../plan/deploy/deployment-guide.md#part-2--operating--troubleshooting-the-live-server)
> - **Architecture / IaC reference + cost model** → [Part 3](../plan/deploy/deployment-guide.md#part-3--reference-architecture-iac--cost-model)
>
> The orchestrator design doc ([`plan/plan.md` §10](../plan/plan.md#10-aws-deployment--ec2--rds-via-cloudformation))
> maps to it. The **frontend** build/serve steps are in the
> [UI guide → Deployment (frontend)](../plan/ui/ui-development-guide.md#part-f3--deployment-frontend).

## The four concerns

Deployment is split into four independent steps, each with its own script under `scripts/`. They
run in this order the first time; afterwards you run only the one that changed.

| # | Concern | Script | What it owns |
|---|---------|--------|--------------|
| 1 | **secrets** | `scripts/deploy-secrets.sh` | Secrets Manager: the RDS credentials (`ltride/db`) and the Flask `SECRET_KEY` (`ltride/app`). Deployed **first** — the database resolves its password from `ltride/db`. |
| 2 | **infra** | `scripts/deploy-infra.sh` | CloudFormation stacks in dependency order: network → database → compute → dns. |
| 3 | **db** | `scripts/deploy-db.sh` | Applies `backend/webapp/sql/migrations/*.sql` against the private RDS (over SSH, on the box). |
| 4 | **app** | `scripts/deploy-app.sh` | Ships code: backend (pull + pip + restart gunicorn) and frontend (build + rsync to nginx). |

## Layout

```
deploy/
├── cfn/                     # CloudFormation templates (the infrastructure, as code)
│   ├── 00-secrets.yaml      #   Secrets Manager: ltride/db + ltride/app (deploy FIRST)
│   ├── 01-network.yaml      #   VPC, public/private subnets, IGW, security groups
│   ├── 02-database.yaml     #   RDS PostgreSQL (resolves its password from ltride/db)
│   ├── 03-compute.yaml      #   EC2 + Elastic IP + IAM instance role + UserData bootstrap
│   └── 04-dns.yaml          #   Route 53 A record → Elastic IP
├── params/
│   └── prod.json            # stack parameters (AdminCidr, KeyName, DomainName, HostedZoneId, ...)
└── server/                  # files installed onto the EC2 box
    ├── nginx-ltride.conf    #   nginx: serve React build + SPA fallback + proxy /api
    ├── ltride.service       #   systemd unit running gunicorn + Flask (from backend/)
    └── provision.sh         #   on-server provisioning steps (mirrors 03-compute UserData)
```

The runnable scripts live in [`scripts/`](../scripts/):

```
scripts/
├── deploy.sh                # single entrypoint — checks AWS credentials, dispatches to a concern
├── deploy-secrets.sh        # concern 1
├── deploy-infra.sh          # concern 2
├── deploy-db.sh             # concern 3
├── deploy-app.sh            # concern 4
├── lib/deploy-common.sh     # shared helpers (env, AWS wrappers, stack + secret + SSH resolvers)
└── aws-credential.sh.example # copy to aws-credential.sh (gitignored) or use `aws configure`
```

## Quick start

Run everything through the one entrypoint, `scripts/deploy.sh <concern> <subcommand>`. It sources
optional AWS credentials from `scripts/aws-credential.sh` (if present) and verifies them with
`aws sts get-caller-identity` before doing anything.

```bash
# 0. Credentials: copy the example and fill it in, OR use `aws configure` / a profile.
cp scripts/aws-credential.sh.example scripts/aws-credential.sh   # then edit (gitignored)

# 1. First-time bring-up, guided end to end (secrets → infra → db → app):
scripts/deploy.sh all

# ...or one concern at a time, in order:
scripts/deploy.sh secrets init        # create the ltride/db + ltride/app secrets stack
scripts/deploy.sh infra up             # network → database → compute → dns
scripts/deploy.sh db migrate           # apply backend/webapp/sql/migrations/*.sql on the box
scripts/deploy.sh app all              # deploy backend, then build + ship the frontend

# Day-to-day (run only what changed):
scripts/deploy.sh app backend          # code change, no schema change
scripts/deploy.sh db migrate           # new migration → run this BEFORE `app`
scripts/deploy.sh app frontend         # UI-only change

# Inspect / tear down:
scripts/deploy.sh infra outputs        # print stack outputs (EC2 IP, RDS endpoint, ...)
scripts/deploy.sh infra status         # per-stack status
scripts/deploy.sh destroy              # guided teardown, reverse order (RDS leaves a snapshot)
```

`-e/--env <name>` selects `params/<name>.json` (default `prod`). Region comes from `AWS_REGION`
(default `us-east-1`); the SSH key is read from `~/.ssh/<KeyName>.pem` (override with `SSH_KEY`);
the box host is read from the compute stack's Elastic IP (override with `EC2_HOST`). Fill in your
real values in `params/prod.json` before running — see D0 in the deployment guide's Part 1.
