# Deploying LTRide to AWS — runbook

Step-by-step for a first (and repeat) deploy of LTRide to an AWS account. It drives
the CloudFormation templates in [`cfn/`](cfn/) and the on-box config in
[`server/`](server/) through **[`scripts/deploy.sh`](../scripts/deploy.sh)** — the
credential-checked entrypoint that loads `scripts/aws-credential.sh` (if present),
verifies it with `aws sts get-caller-identity`, then forwards to one of four concern
scripts ([`deploy-secrets.sh`](../scripts/deploy-secrets.sh) /
[`deploy-infra.sh`](../scripts/deploy-infra.sh) / [`deploy-db.sh`](../scripts/deploy-db.sh) /
[`deploy-app.sh`](../scripts/deploy-app.sh)). `scripts/deploy.sh all` walks the whole
first-boot flow interactively.

- **Quick reference** — this file. One page, command-first.
- **Teaching walkthrough** (why each piece exists, CR D0–D4, screenshots) →
  [`plan/deploy/deployment-guide.md`](../plan/deploy/deployment-guide.md).
- **Concern/layout overview** → [`deploy/README.md`](README.md).
- **Run it on your laptop first** → [`plan/backend/running-the-poc.md`](../plan/backend/running-the-poc.md)
  (`scripts/local.sh up`).

## Scope (as built)

- Brings up **one EC2 box** serving the React build over **nginx** on port **80**,
  reverse-proxying `/api/` to **gunicorn/Flask** on `127.0.0.1:8000`
  ([`server/nginx-ltride.conf:52-55`](server/nginx-ltride.conf),
  [`server/ltride.service:47-52`](server/ltride.service)).
- **HTTPS is not templated.** TLS is turned on by running **certbot on the box** after
  DNS resolves (see [Custom domain + HTTPS](#custom-domain--https)); the security group
  already opens 443 ([`cfn/01-network.yaml:135`](cfn/01-network.yaml)).
- **One environment per account/region.** Stack names are fixed `ltride-<suffix>`, not
  env-scoped, so a second environment needs a second account or region
  ([`scripts/lib/deploy-common.sh:20-23`](scripts/lib/deploy-common.sh)).

**Out of scope (by design):** load balancer, autoscaling, CDN, S3 media, background
workers/queues, multi-AZ RDS. This is a single-box teaching deployment; see
[Deferred](#deferred--not-templated) for what a production hardening pass would add.

## Topology (what gets created)

Four CloudFormation stacks, deployed in dependency order, plus two Secrets Manager
secrets created by a fifth (bootstrap) stack:

```
                         Secrets Manager: ltride/db (RDS user/pass), ltride/app (SECRET_KEY)
                                     │ read at boot via the box's IAM instance role
   browser ──▶ Route 53 A record ──▶ EC2 box  ┌ nginx :80/:443  ──▶ gunicorn 127.0.0.1:8000 (Flask)
              (DomainName → EIP)    (Ubuntu)   └ /var/www/ltride (React build)
                                        │
                                        └──▶ RDS PostgreSQL 16 :5432 (private; web SG only)
```

- **secrets** ([`cfn/00-secrets.yaml`](cfn/00-secrets.yaml)) — `ltride/db` (auto-generated
  username `ltride` + 24-char password) and `ltride/app` (auto-generated 48-char
  `secret_key`). Deployed first: the database resolves its password from `ltride/db`.
- **network** ([`cfn/01-network.yaml`](cfn/01-network.yaml)) — VPC, two public subnets,
  internet gateway, and two security groups: web (80/443 world, 22 from `AdminCidr`) and
  db (5432 from the web SG only).
- **database** ([`cfn/02-database.yaml`](cfn/02-database.yaml)) — RDS PostgreSQL 16
  (`db.t3.micro`, 20 GB, private, `MultiAZ: false`, 7-day backups, `DeletionPolicy:
  Snapshot`).
- **compute** ([`cfn/03-compute.yaml`](cfn/03-compute.yaml)) — Ubuntu 22.04 EC2
  (`t3.micro`) + Elastic IP + an IAM instance role scoped to read **only** the two
  secrets. First-boot UserData clones the repo, builds the venv, writes `backend/.env`
  from the secrets, runs migrations, and starts the services (mirrors
  [`server/provision.sh`](server/provision.sh)).
- **dns** ([`cfn/04-dns.yaml`](cfn/04-dns.yaml)) — a Route 53 A record `DomainName → EIP`.
  Skipped automatically while `HostedZoneId` is still the placeholder, so the deploy
  succeeds before you own a domain ([`cfn/04-dns.yaml:40-41`](cfn/04-dns.yaml)).

## Prerequisites

On your machine:

- **AWS CLI v2** and **Node 18+** (the `app frontend` step builds the SPA locally, then
  rsyncs `dist/` to the box — [`scripts/deploy-app.sh:40-49`](scripts/deploy-app.sh)).
- Credentials for the target account (see below). Default region **`us-east-1`**; set
  `AWS_REGION` to deploy elsewhere ([`scripts/lib/deploy-common.sh:28`](scripts/lib/deploy-common.sh)).

Created once by hand in the AWS console (they are inputs, not created by these stacks):

- An **EC2 key pair** whose name you put in `params` as `KeyName`; keep the `.pem` at
  `~/.ssh/<KeyName>.pem` (override with `SSH_KEY`). The `db` and `app` concerns SSH in
  with it ([`scripts/lib/deploy-common.sh:202-207`](scripts/lib/deploy-common.sh)).
- **(Optional, for a custom domain)** a **Route 53 hosted zone** for your domain; copy its
  zone ID into `params` as `HostedZoneId`. Leave the placeholder to skip DNS for now.

> **The box clones over public HTTPS.** UserData clones
> `https://github.com/LTRide2/lt-parking-site-project.git`
> ([`cfn/03-compute.yaml:169`](cfn/03-compute.yaml)). If the repo is private, bake a
> read-only token into `RepoUrl` or attach a deploy key — otherwise first boot fails at
> the clone.

### Configure AWS credentials

The scripts hold no auth logic — they call the `aws` CLI, which resolves credentials from
the standard chain. Two supported ways:

- **A profile** (`aws configure` / `aws sso login`) — nothing else to create; `deploy.sh`
  uses your default profile or `AWS_PROFILE`.
- **A credential file** the entrypoint sources
  ([`scripts/deploy.sh:78-82`](scripts/deploy.sh)):
  ```bash
  cp scripts/aws-credential.sh.example scripts/aws-credential.sh   # gitignored — never commit
  # edit it: export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION
  ```

Verify before deploying — this is exactly the check `deploy.sh` runs:

```bash
aws sts get-caller-identity     # must print the target account id + your identity
```

### Fill in `deploy/params/prod.json`

`-e <env>` selects `params/<env>.json` (default `prod`). Every stack receives the whole
file, so all six keys must be present ([`cfn/01-network.yaml:12-17`](cfn/01-network.yaml)):

| Key | What to set it to |
|-----|-------------------|
| `AdminCidr` | Your public IP as `x.x.x.x/32` (`curl ifconfig.me`, then `/32`) — the only IP allowed to SSH. |
| `KeyName` | The EC2 key pair name from the prerequisites. |
| `DomainName` | Your hostname (e.g. `ltride.example.edu`); baked into `CORS_ORIGINS` and the frontend's `VITE_API_URL`. |
| `HostedZoneId` | Your Route 53 zone ID; leave the placeholder `Z0123456789ABCDEFGHIJ` to skip DNS. |
| `WebInstanceType` | `t3.micro` (free-tier eligible). |
| `DbInstanceClass` | `db.t3.micro` (cheapest burstable). |

## Secrets

Both secrets are created **empty-then-auto-filled** by one stack — `secrets init`
generates a strong DB password and Flask `secret_key` for you, so a first-time deploy
needs **no hand-entered secret** ([`cfn/00-secrets.yaml:36-53`](cfn/00-secrets.yaml)).

```bash
scripts/deploy.sh secrets init     # deploy the stack; auto-generate db password + secret_key
scripts/deploy.sh secrets list     # show every secret's name AND value (don't paste anywhere shared)
```

To set or rotate one value by name (accepted names: `db_username`, `db_password` →
`ltride/db`; `secret_key` → `ltride/app`):

```bash
scripts/deploy.sh secrets db_password '<new-password>'
```

> **Invariant: a secret is never committed and never logged.** The stored values live only
> in Secrets Manager and, at runtime, in the box's `0600` `backend/.env` written by
> UserData ([`cfn/03-compute.yaml:136-143`](cfn/03-compute.yaml)); the IAM role can read
> only these two secrets ([`cfn/03-compute.yaml:59-64`](cfn/03-compute.yaml)).
>
> **Caveat:** `secrets <name> <value>` puts the value on your command line (visible in `ps`
> and shell history) even though it reaches AWS via a `0600` temp file, never the CLI args
> ([`scripts/lib/deploy-common.sh:166-172`](scripts/lib/deploy-common.sh)). Prefer the
> auto-generated values from `init`; type a value only when you must rotate one.
>
> **Rotating `db_password` does not touch the live RDS password**
> ([`scripts/deploy-secrets.sh:41-43`](scripts/deploy-secrets.sh)) — update RDS separately
> (e.g. `aws rds modify-db-instance --master-user-password`), then release the app.

## Deploy

Drive everything through **`scripts/deploy.sh`**. Four concerns, run in this order the
first time; afterwards run only the one that changed:

| # | Concern | `deploy.sh` group → script | What it touches |
|---|---------|-----------------------------|-----------------|
| 1 | Secrets | `secrets` → `deploy-secrets.sh` | Secrets Manager (`ltride/db`, `ltride/app`) |
| 2 | Infrastructure | `infra` → `deploy-infra.sh` | CloudFormation: network → database → compute → dns |
| 3 | Database | `db` → `deploy-db.sh` | Apply `backend/webapp/sql/migrations/*.sql` on the box, against RDS |
| 4 | Application | `app` → `deploy-app.sh` | Backend (pull + pip + restart gunicorn) and frontend (build + rsync to nginx) |

**Guided (recommended for a first deploy)** — creates the secrets if absent, then prompts
before each of infra / db / app ([`scripts/deploy.sh:97-123`](scripts/deploy.sh)):

```bash
scripts/deploy.sh -e prod all
```

**Or step by step:**

```bash
ENV=prod

# 1) SECRETS (bootstrap; must precede the database stack).
scripts/deploy.sh -e $ENV secrets init

# 2) INFRASTRUCTURE: network -> database -> compute -> dns.
#    First run is ~15-20 min (RDS is the slow part). compute uses CAPABILITY_NAMED_IAM.
scripts/deploy.sh -e $ENV infra up

# 3) DATABASE: apply SQL migrations on the box (RDS is private, so migrations run over SSH).
scripts/deploy.sh -e $ENV db migrate

# 4) APPLICATION: release backend, then build + ship the frontend.
scripts/deploy.sh -e $ENV app all
```

Every step is idempotent — CloudFormation no-ops on an empty change set
([`scripts/lib/deploy-common.sh:85`](scripts/lib/deploy-common.sh)) — so re-running `all`
applies only what is new. `infra` preflight-checks that the secrets exist and stops with a
fix hint if not ([`scripts/deploy-infra.sh:20-28`](scripts/deploy-infra.sh)).

On first boot the compute stack's UserData already provisions the box and runs migrations,
so `db migrate` / `app all` on a fresh stack are effectively re-applies that also pull the
newest code.

## Ship a code change

Once the environment is up, a code change reaches the box by **pulling the latest commit on
the box and restarting** (backend) or **rebuilding + rsyncing** (frontend). Commit and push
to the deployed branch first — the box does `git pull --ff-only`
([`scripts/deploy-app.sh:18`](scripts/deploy-app.sh)).

| Change | Commands (in order) |
|--------|---------------------|
| **Backend code only** | `scripts/deploy.sh app backend` |
| **Frontend only** | `scripts/deploy.sh app frontend` |
| **Both, no schema change** | `scripts/deploy.sh app all` |
| **Adds a SQL migration** | `scripts/deploy.sh db migrate` → then `scripts/deploy.sh app all` |

- `app backend` pulls, `pip install`s, restarts the `ltride` systemd service, then
  health-checks `http://127.0.0.1:8000/api/health` on the box
  ([`scripts/deploy-app.sh:25-29`](scripts/deploy-app.sh)).
- `app frontend` builds with `VITE_API_URL=https://<DomainName>` (falls back to the box IP
  when `DomainName` is unset) and rsyncs `dist/` into `/var/www/ltride`
  ([`scripts/deploy-app.sh:36-51`](scripts/deploy-app.sh)).
- Run `db migrate` **before** `app` on a schema change so the new columns exist before the
  new code serves traffic.

## Verify

```bash
scripts/deploy.sh -e prod infra status       # per-stack status
scripts/deploy.sh -e prod infra outputs       # read ElasticIp (and the RDS endpoint) here

# Health, hitting the box directly by its Elastic IP (use your domain once DNS + TLS are up):
curl -fsS "http://<ElasticIp>/api/health"     # {"data":{"status":"ok",...}}
```

On the box (`ssh -i ~/.ssh/<KeyName>.pem ubuntu@<ElasticIp>`):

```bash
sudo systemctl status ltride         # gunicorn: active (running)
sudo journalctl -u ltride -n 50      # recent backend logs
sudo nginx -t                        # nginx config valid
```

## Rollback

The box tracks a git branch, so rolling back means checking out a known-good commit and
re-releasing. SSH in as the `ltride` user (or via SSM), then:

```bash
cd /home/ltride/app
sudo -u ltride git checkout <good-sha>
cd backend && sudo -u ltride .venv/bin/pip install -q -r webapp/requirements.txt
sudo systemctl restart ltride
```

Then rebuild the matching frontend locally and `scripts/deploy.sh app frontend`. RDS keeps
7-day automated backups and a final snapshot on stack delete
([`cfn/02-database.yaml:54-76`](cfn/02-database.yaml)); restore from a snapshot if a
migration needs undoing.

## Custom domain + HTTPS

DNS is one CloudFormation record; TLS is a manual certbot run on the box (not templated).
Full walkthrough with the registrar/nameserver details:
[deployment-guide.md → CR D4](../plan/deploy/deployment-guide.md#cr-d4--buy-a-domain-wire-it-to-route-53-and-turn-on-https).

1. Create a **Route 53 hosted zone** for your domain and put its ID in
   `params/prod.json` as `HostedZoneId` (and set `DomainName`). If the domain was bought
   elsewhere, delegate its nameservers to Route 53's four `awsdns` servers first.
2. `scripts/deploy.sh -e prod infra up` — now the `dns` stack creates the A record
   `DomainName → EIP`. Confirm with `dig <domain> +short`.
3. SSH in and issue the cert (certbot rewrites nginx to add `listen 443 ssl`, the
   `server_name`, and an HTTP→HTTPS redirect, and installs auto-renew):
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d <domain>
   ```
4. `scripts/deploy.sh -e prod app frontend` to rebuild the SPA against `https://<domain>`
   (the backend already trusts it — UserData set `CORS_ORIGINS=https://<DomainName>`,
   [`cfn/03-compute.yaml:139`](cfn/03-compute.yaml)).

## Teardown

The reverse of `all`. Deleting the stacks stops the ongoing charges (EC2, RDS, EIP):

```bash
scripts/deploy.sh -e prod destroy
```

- Requires you to **type the environment name** to confirm
  ([`scripts/deploy.sh:132-134`](scripts/deploy.sh)), then deletes **dns → compute →
  database → network** (reverse of create order, since network is imported by the others)
  and asks whether to also delete the secrets (**kept by default**).
- **RDS leaves a final snapshot** (`DeletionPolicy: Snapshot`) — delete it manually with
  `aws rds delete-db-snapshot` once you are sure you no longer need the data.
- **Secrets** deletion is scheduled with a recovery window; skip `secrets destroy` to keep
  the values for a later redeploy.

## Deferred / not templated

Required before a real public launch; each is a small, separate addition:

- **HTTPS as code** — TLS is a manual certbot step today. *Mitigation:* the SG already
  opens 443; certbot auto-renews. A production pass would move the cert to ACM behind a
  load balancer or bake certbot into UserData.
- **Second environment** — stack names are not env-scoped, so `dev` and `prod` cannot
  co-exist in one account/region. *Mitigation:* deploy `-e dev` into a separate account or
  region, or parameterize the stack names.
- **No high availability** — single EC2, single-AZ RDS. *Residual risk accepted* for a
  teaching deployment; an ALB + Auto Scaling group + `MultiAZ: true` would remove the
  single points of failure.
- **SSH open to `AdminCidr` only** — rotate the `.pem`, and narrow `AdminCidr` whenever your
  IP changes ([`cfn/01-network.yaml:136-139`](cfn/01-network.yaml)).

## Glossary

- **Concern** — one of the four independent deploy steps (secrets / infra / db / app), each
  its own script under `scripts/`.
- **Stack** — a CloudFormation deployment unit; this project has five (`ltride-secrets`,
  `-network`, `-database`, `-compute`, `-dns`).
- **Secrets Manager** — the AWS service that stores `ltride/db` and `ltride/app`; the box
  reads them at boot via its IAM instance role.
- **Instance role / instance profile** — the IAM identity attached to the EC2 box; here it
  is allowed to read exactly the two secrets and nothing else.
- **Elastic IP (EIP)** — a fixed public IP kept across stop/start, so the DNS record never
  has to change.
- **UserData** — the first-boot script CloudFormation runs on the EC2 instance; it mirrors
  `deploy/server/provision.sh`.
- **gunicorn** — the production WSGI server running the Flask app (`webapp.App:app`) behind
  nginx on `127.0.0.1:8000`.
- **certbot** — the Let's Encrypt client that issues the TLS certificate and edits nginx on
  the box.
