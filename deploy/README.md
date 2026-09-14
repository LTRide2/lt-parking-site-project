# `deploy/` — Deployment home

This folder is the **home for all deployment artifacts** for LTRide: the Infrastructure-as-Code
templates, the wrapper scripts that run them, the stack parameters, and the on-server config files.

> **Docs live in the deployment guide, not here.** The authoritative deployment documentation is in
> [`plan/deploy/deployment-guide.md`](../plan/deploy/deployment-guide.md):
> - **Step-by-step tutorial** → [Part 1 — Deploy to AWS (CRs D0–D4)](../plan/deploy/deployment-guide.md#part-1--deploy-to-aws-step-by-step-crs-d0d4)
> - **Operating & troubleshooting the live server** → [Part 2](../plan/deploy/deployment-guide.md#part-2--operating--troubleshooting-the-live-server)
> - **Architecture / IaC reference + cost model** → [Part 3](../plan/deploy/deployment-guide.md#part-3--reference-architecture-iac--cost-model)
>
> The orchestrator design doc ([`plan/plan.md` §10](../plan/plan.md#10-aws-deployment--ec2--rds-via-cloudformation))
> maps to it. The **frontend** build/serve steps are in the
> [UI guide → Deployment (frontend)](../plan/ui/ui-development-guide.md#part-f3--deployment-frontend).

## Layout

```
deploy/
├── cfn/                     # CloudFormation templates (the infrastructure, as code)
│   ├── 01-network.yaml      #   VPC, public/private subnets, IGW, security groups
│   ├── 02-database.yaml     #   RDS PostgreSQL + Secrets Manager-generated password
│   ├── 03-compute.yaml      #   EC2 + Elastic IP + IAM instance role + UserData bootstrap
│   └── 04-dns.yaml          #   Route 53 A record → Elastic IP
├── params/
│   └── prod.json            # stack parameters (AdminCidr, KeyName, DomainName, HostedZoneId, ...)
├── server/                  # files installed onto the EC2 box
│   ├── nginx-ltride.conf    #   nginx: serve React build + SPA fallback + proxy /api
│   ├── ltride.service       #   systemd unit running gunicorn + Flask
│   └── provision.sh         #   on-server provisioning steps
├── deploy.sh                # wrapper: validate + create/update the CloudFormation stacks
└── release.sh               # ship application code (backend + frontend) onto the server
```

## Quick start

```bash
# Infrastructure (create/update the AWS stacks, in dependency order):
./deploy.sh validate      # validate all templates, make no changes
./deploy.sh up            # create/update all stacks (env defaults to prod)
./deploy.sh outputs       # print stack outputs (EC2 IP, RDS endpoint, ...)
./deploy.sh down          # tear everything down (RDS leaves a final snapshot)

# Application code (after the infrastructure exists):
./release.sh all          # deploy backend then frontend
./release.sh backend      # git pull + pip install + DB migrate + restart gunicorn
./release.sh frontend     # build with prod VITE_API_URL + rsync dist/ to nginx
```

Region/profile come from `AWS_REGION` / `AWS_PROFILE`; the SSH key is read from
`~/.ssh/<KeyName>.pem` (override with `SSH_KEY`). Fill in your real values in
`params/prod.json` before running `up` — see D0 in the deployment guide's Part 1.
