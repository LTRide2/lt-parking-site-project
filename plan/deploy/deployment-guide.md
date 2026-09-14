and# LTRide — Deployment Guide (AWS)

> **Where this doc sits.** This is the **deployment** design + implementation doc, a sibling of the [UI guide](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/ui-development-guide.md) and the [backend guide](../backend/backend-development-guide.md), all orchestrated by [`../plan.md`](../plan.md). It owns everything about getting the app **onto AWS and keeping it running**: the step-by-step deploy CRs (D0–D4), live-server operations, and the full architecture/IaC/cost reference. The master plan links here from [`../plan.md` §10](../plan.md#10-aws-deployment--ec2--rds-via-cloudformation).
>
> - **Backend build** (the app these steps deploy) → [backend guide](../backend/backend-development-guide.md)
> - **Frontend build & serve** (the SPA nginx serves) → [UI guide → Deployment (frontend)](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/ui-development-guide.md#part-f3--deployment-frontend)
> - **Runnable artifacts** (templates, scripts, server config) → repo-root [`deploy/`](../../deploy/README.md)
> - **CR ordering & status** → [`../plan.md` §8.2 tracker](../plan.md#82-cr-status-tracker)

This guide has three parts:

1. **[Deploy to AWS, step by step (CRs D0–D4)](#part-1--deploy-to-aws-step-by-step-crs-d0d4)** — the click-by-click tutorial: account setup, templates, provisioning, releasing code, DNS + HTTPS.
2. **[Operating & troubleshooting the live server](#part-2--operating--troubleshooting-the-live-server)** — day-to-day ops once it's live.
3. **[Reference: architecture, IaC & cost model](#part-3--reference-architecture-iac--cost-model)** — the design detail behind the steps: target architecture, every CloudFormation stack, the AWS-services inventory, and the monthly + professional cost model.

---

## Verify locally before you deploy

Confirm the app works end-to-end on your machine before shipping it to AWS:

```bash
scripts/local.sh up      # Postgres + Flask API + React UI
scripts/local.sh down    # stop everything
```

Local run details: [`running-the-poc.md`](../backend/running-the-poc.md). Deploying to
AWS uses `scripts/deploy.sh` (covered in the steps below).

## Part 1 — Deploy to AWS, step by step (CRs D0–D4)

> **Big picture:** we rent one small Linux computer from Amazon (**EC2**) to run the Flask backend, and one managed database (**RDS PostgreSQL**) for the data. We describe all of this in code (**CloudFormation**, called "IaC" = infrastructure as code) so it's repeatable. One entrypoint, `scripts/deploy.sh <concern> <subcommand>`, does the work, split into **four concerns** you run in order:
> - **secrets** — create the DB credentials + app `SECRET_KEY` in Secrets Manager (first, so the database can resolve its password).
> - **infra** — create/update the AWS infrastructure (network, database, server, DNS).
> - **db** — apply SQL migrations to the database.
> - **app** — ship your latest code (backend + frontend) onto the server.
>
> You should have finished at least backend B1 (a working backend locally, see the [backend guide](../backend/backend-development-guide.md#cr-b1--health-check-prove-the-server-runs)) before deploying. The full deep-dive on each CloudFormation stack — architecture, IaC layout, every stack's snippets, the AWS-services inventory, and the cost model — lives in [**Part 3 — Reference**](#part-3--reference-architecture-iac--cost-model) below. This Part 1 is the click-by-click version.

### Deployment vocabulary

- **EC2** — a virtual computer in Amazon's data center.
- **RDS** — a database Amazon runs and backs up for you.
- **CloudFormation / stack** — a YAML file describing AWS resources; a "stack" is one deployed copy of it.
- **Security group** — a firewall: which ports/IPs may connect.
- **Elastic IP** — a fixed public address for your server.
- **SSH** — a secure way to log into the server from your terminal.
- **Secrets Manager** — where AWS stores the database password + app `SECRET_KEY` safely.

> **Windows note:** `scripts/deploy.sh` and the concern scripts it calls are `#!/bin/bash` scripts and
> do not run in PowerShell or `cmd`. On Windows, invoke them from **Git Bash** (bundled with
> [Git for Windows](https://git-scm.com/download/win)) or **WSL** — e.g. `bash scripts/deploy.sh infra up`.
> The `aws`, `ssh`, `scp`, and `ssh-keygen` commands below work natively in PowerShell (Windows
> ships OpenSSH); only the bash wrapper scripts need Git Bash/WSL. Steps below give a
> **macOS / Linux** and a **Windows (PowerShell)** variant side by side wherever they differ.

---

### D0 — One-time AWS account setup (not a code CR, but do it once)

1. **Create an AWS account** at <https://aws.amazon.com> (a credit card is required; the small instances we use cost a few dollars a month — **remember to run `scripts/deploy.sh destroy` when you're done experimenting** to stop charges).
2. **Create an admin IAM user** (don't use the root account day-to-day). In the AWS Console → IAM → Users → create a user with programmatic access and `AdministratorAccess` (for a school project this is acceptable; tighten later). Save the **Access key ID** and **Secret access key**.
3. **Install & configure the AWS CLI.** Our script installs it for you, but you must give it your keys:

   **macOS / Linux**
   ```bash
   cd ~/workspace/lt-parking-site-project
   scripts/deploy.sh infra validate   # dry-check the templates (needs awscli configured)
   aws configure                      # paste your Access key, Secret, region us-east-1, output json
   ```

   **Windows (PowerShell)**
   ```powershell
   winget install Amazon.AWSCLI       # if aws isn't already installed
   cd $HOME\workspace\lt-parking-site-project
   bash scripts/deploy.sh infra validate   # bash script — run it from Git Bash/WSL
   aws configure                      # paste your Access key, Secret, region us-east-1, output json
   ```
4. **Create an SSH key pair** named `ltride-key` (AWS Console → EC2 → Key Pairs → Create), download `ltride-key.pem`, and move it where the scripts expect:

   **macOS / Linux**
   ```bash
   mv ~/Downloads/ltride-key.pem ~/.ssh/ltride-key.pem
   chmod 600 ~/.ssh/ltride-key.pem
   ```

   **Windows (PowerShell)** — Windows OpenSSH keys live under `$HOME\.ssh`; use `icacls` instead of `chmod` to lock the key to your own account:
   ```powershell
   Move-Item $HOME\Downloads\ltride-key.pem $HOME\.ssh\ltride-key.pem
   icacls $HOME\.ssh\ltride-key.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
   ```
5. **Fill in `deploy/params/prod.json`** with your real values:
   - `AdminCidr` — your home IP followed by `/32` (find it at <https://whatismyip.com>); this restricts SSH to you.
   - `KeyName` — `ltride-key` (must match step 4).
   - `DomainName` / `HostedZoneId` — only if you own a domain; otherwise you'll use the raw IP and can skip the DNS stack for now.

---

### CR D1 — Write the CloudFormation templates (the infrastructure code)

**Depends on:** nothing in the app. **Branch:** `cr/d1-cfn-templates` (off `main`).

**Goal:** have the five template files the scripts expect, in `deploy/cfn/`. These are now **already written and committed** (heavily commented so you can read what every resource does); your job in this CR is to understand them and confirm they validate. The five files:

- `deploy/cfn/00-secrets.yaml` — the two Secrets Manager secrets, `ltride/db` (RDS username + generated password) and `ltride/app` (generated `SECRET_KEY`). Deployed **first** (by `scripts/deploy.sh secrets init`) so the database can resolve its password. Exports `ltride-DbSecretArn` and `ltride-AppSecretArn`.
- `deploy/cfn/01-network.yaml` — VPC, two public subnets (RDS needs two AZs), internet gateway, and the web + database security groups (firewalls).
- `deploy/cfn/02-database.yaml` — RDS PostgreSQL; it **resolves** its username/password from the `ltride/db` secret (created by `00-secrets.yaml`), so the DB password is never written in plaintext.
- `deploy/cfn/03-compute.yaml` — the EC2 instance + Elastic IP + an IAM role that may read only the two `ltride/*` secrets + UserData that clones the monorepo, builds the `backend/` venv, and writes `backend/.env` (DB creds from `ltride/db`, `SECRET_KEY` from `ltride/app`) on first boot.
- `deploy/cfn/04-dns.yaml` — Route 53 A record (domain → Elastic IP). It is guarded by a `HasHostedZone` condition: while `HostedZoneId` is still the placeholder in `params/prod.json`, the stack creates nothing, so the deploy succeeds even before you own a domain.

> **Two non-obvious rules these templates follow** (worth knowing if you edit them):
> 1. The deploy scripts pass the *entire* `params/prod.json` to *every* stack, and CloudFormation rejects an override for a parameter a template doesn't declare. So **every template declares all six keys** (`AdminCidr`, `KeyName`, `DomainName`, `HostedZoneId`, `WebInstanceType`, `DbInstanceClass`) — the unused ones are simply never referenced, which is allowed.
> 2. There is no output→param wiring between stacks, so cross-stack values travel via **`Export` / `Fn::ImportValue`** (e.g. the network stack exports `ltride-VpcId`, the compute stack imports `ltride-DbEndpoint`). Rename an export → update its importers.

**One thing to check before deploying:** in `03-compute.yaml`, the `RepoUrl` near the bottom of the UserData block is set to the monorepo (`https://github.com/LTRide2/lt-parking-site-project.git`). If you forked it, point `RepoUrl` at *your* fork's clone URL, or the instance can't fetch the code on boot. If your repo is private, use a read-only token URL or a deploy key (see the comment in the template).

**Local testing guide:**
1. Setup: AWS CLI configured (D0); at the repo root.
2. Steps:
   ```bash
   scripts/deploy.sh infra validate
   ```
3. Expected: prints `valid: 01-network.yaml` … through all four. No template errors. **No AWS resources are created by `validate`** — it's a dry check that just asks AWS "is this template well-formed?".

---

### CR D1b — Server configuration files (nginx, gunicorn/systemd, provisioning)

**Depends on:** D1. **Branch off D1** (`cr/d1b-server-config`).

**Goal:** create the files that turn a bare Ubuntu box into a working LTRide server. The CloudFormation compute stack (D1's `03-compute.yaml`) runs these at first boot via **UserData**; they also let you re-provision or fix a server by hand. They live in `deploy/server/`:

| File | Goes on the server at | Job |
|---|---|---|
| `nginx-ltride.conf` | `/etc/nginx/sites-available/ltride` | Serve the React build **and** reverse-proxy `/api` to gunicorn |
| `ltride.service` | `/etc/systemd/system/ltride.service` | Keep gunicorn (Flask) running & restart on crash/reboot |
| `provision.sh` | run once as root | Install packages, create the user, build the venv, wire the two files above, start everything |

> **The request journey (why we need all three):**
> ```
> Browser ──HTTP(S)──▶ nginx :80/:443 ──┬─ /…       → serve files from /var/www/ltride (the React app)
>                                        └─ /api/…   → proxy to gunicorn 127.0.0.1:8000 → Flask → RDS
> ```
> nginx is the only thing exposed to the internet. gunicorn listens on localhost only, so the API can't be reached except *through* nginx — one hardened front door.

#### File 1 — `deploy/server/nginx-ltride.conf` (the web server / reverse proxy)

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;                 # matches any hostname (until a domain + certbot set a real one)

    client_max_body_size 10M;      # allow map-image uploads (nginx default is 1M → 413 errors)

    root /var/www/ltride;          # where `deploy.sh app frontend` puts the built React files
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback: refresh of /admin serves index.html
    }

    location /assets/ {            # Vite's hashed bundles — safe to cache forever
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;                    # forward to gunicorn
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```
**Line-by-line, the parts that matter most:**
- **`server_name _;`** — `_` is nginx's "match any hostname." Fine when you only reach the box by IP. When you add a domain, `certbot` edits this to your real name so it can issue a certificate for it.
- **`client_max_body_size 10M;`** — nginx rejects request bodies over **1 MB by default** with `413 Request Entity Too Large`. Map uploads (U7) need more, so we raise it. This is the single most common "works locally, 413 in the cloud" gotcha.
- **`root` + `index`** — where the static React files live and the default file to serve.
- **`location / { try_files $uri $uri/ /index.html; }`** — the **SPA fallback**. React Router invents URLs like `/admin` that aren't files on disk. `try_files` tries the literal file, then a folder, and **falls back to `index.html`** so the React app boots and routes the URL itself. Without this, refreshing `/admin` returns a 404. (This is exactly the "deep-link 404" warning in UI CR **U2**.)
- **`location /assets/ { expires 1y; immutable }`** — Vite fingerprints bundle filenames with a hash, so a new deploy = a new filename. That makes it safe to tell browsers to cache them forever; users still get new code instantly because the filename changed.
- **`location /api/ { proxy_pass … }`** — the **reverse proxy**. Everything under `/api/` is forwarded to gunicorn on `127.0.0.1:8000`. The `proxy_set_header` lines pass the *real* visitor's host/IP/scheme through to Flask (otherwise your logs would just show `127.0.0.1`, i.e. nginx talking to itself). `X-Forwarded-Proto` tells Flask whether the original request was http or https.

#### File 2 — `deploy/server/ltride.service` (gunicorn under systemd)

```ini
[Unit]
Description=LTRide backend (gunicorn)
After=network.target

[Service]
User=ltride
Group=ltride
# The monorepo is cloned at /home/ltride/app; the Flask backend is the backend/
# subtree, so we run from there (that's where "webapp.App:app" imports from).
WorkingDirectory=/home/ltride/app/backend
EnvironmentFile=/home/ltride/app/backend/.env
ExecStart=/home/ltride/app/backend/.venv/bin/gunicorn \
    --workers 3 \
    --bind 127.0.0.1:8000 \
    --access-logfile - \
    --error-logfile - \
    webapp.App:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
**What each line buys you:**
- **`After=network.target`** — don't start before networking is up (we connect to RDS over the network).
- **`User=ltride` / `Group=ltride`** — run as an unprivileged service account, **never root**. If the app is compromised, the damage is limited to this one account.
- **`EnvironmentFile=…/.env`** — the production secrets (`SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`). This is the server's equivalent of your local `.env` — it lives only on the box, readable only by `ltride`, never committed.
- **`ExecStart=…/gunicorn …`** — the actual command. Uses the **venv's** gunicorn (not system Python). `--workers 3` runs 3 processes for concurrency (rule of thumb: `2 × CPU + 1`). `--bind 127.0.0.1:8000` = listen on localhost only (nginx is the public door). `webapp.App:app` = import module `webapp.App`, use the object `app` (the `app = create_app()` from B1). The `-` logfiles send logs to the journal so `journalctl` can show them.
- **`Restart=always` / `RestartSec=3`** — if gunicorn dies, systemd restarts it after 3s. Survives crashes and reboots.
- **`WantedBy=multi-user.target`** — lets `systemctl enable ltride` make it start automatically on every boot.

**Operating it** (on the server):
```bash
sudo systemctl status ltride        # active (running)?
sudo journalctl -u ltride -n 50     # last 50 log lines (your #1 debugging tool)
sudo systemctl restart ltride       # apply a config/code change
sudo systemctl daemon-reload        # after EDITING the .service file itself
```

#### File 3 — `deploy/server/provision.sh` (first-boot setup)

This is what `03-compute.yaml`'s UserData runs (roughly) on a fresh instance, and what you can run by hand to (re)build a box. In order, it: ① `apt-get install` python/nginx/git/`postgresql-client`; ② create the system user `ltride`; ③ clone the monorepo and build the `.venv` **under `backend/`**; ④ write a `backend/.env` template (real secrets come from Secrets Manager in the CFN flow); ⑤ install File 2 into systemd and File 1 into nginx (symlinking it into `sites-enabled` and removing nginx's default welcome page); ⑥ run the SQL migrations against RDS; ⑦ start `ltride` and reload nginx.

> **`REPO_URL`** at the top of `provision.sh` defaults to the monorepo (`lt-parking-site-project`); override it only if you forked. The script installs only the postgres **client** (`psql`) — the database itself is RDS, managed by AWS, not on this box.

**Local testing guide:**
1. Setup: `cd deploy/server`.
2. Steps:
   ```bash
   # config files are static — validate them without a server:
   bash -n provision.sh                 # shell-syntax check (no execution)
   # if you have nginx locally (brew install nginx), you can sanity-test the config:
   nginx -t -c "$PWD/nginx-ltride.conf" 2>&1 | head    # may warn about paths off-server; syntax is what matters
   ```
3. Expected: `bash -n` prints nothing (valid). The real proof is on the server: after D2/D3, SSH in and run `sudo nginx -t` (→ "syntax is ok, test is successful") and `systemctl status ltride` (→ active).

**Commit & push:**
```bash
git add deploy/server/
git commit -m "D1b: nginx + systemd + provisioning config for the server"
git push -u origin cr/d1b-server-config
```
PR base = `cr/d1-cfn-templates`.

---

### CR D2 — Stand up the infrastructure

**Depends on:** D1. **Branch off D1** (`cr/d2-provision`). *(This CR is mostly running commands and recording outputs; the "code" is any small fixes you make to the templates.)*

**Goal:** actually create the secrets, network, database, and server in AWS.

Everything runs through one entrypoint, `scripts/deploy.sh <concern> <subcommand>`,
split into **four concerns** you run in order:

1. **secrets** — create the `ltride/db` (RDS credentials) and `ltride/app`
   (`SECRET_KEY`) secrets. This goes **first** because the database resolves its
   password from `ltride/db`.
2. **infra** — the CloudFormation stacks: network → database → compute → dns.
3. **db** — apply SQL migrations (CR D3).
4. **app** — ship backend + frontend code (CR D3).

This CR covers concerns 1–2.

**Steps:**
```bash
cd ~/workspace/lt-parking-site-project
scripts/deploy.sh secrets init     # create ltride/db + ltride/app (before infra)
scripts/deploy.sh infra up          # validates, then creates all stacks in order
scripts/deploy.sh infra status      # watch until each says CREATE_COMPLETE
scripts/deploy.sh infra outputs     # note the EC2 public IP / Elastic IP
```
This takes ~10–15 minutes (RDS is slow to create). If a stack fails, open the AWS Console → CloudFormation → click the stack → **Events** tab to see the red error, fix the template, and re-run `scripts/deploy.sh infra up` (it updates in place).

**Local testing guide:**
1. Setup: D0 complete; templates valid (D1).
2. Steps: run the three commands above; then SSH in to confirm:

   **macOS / Linux**
   ```bash
   ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp-from-outputs>
   ```

   **Windows (PowerShell)** — same command, native OpenSSH:
   ```powershell
   ssh -i $HOME\.ssh\ltride-key.pem ubuntu@<ElasticIp-from-outputs>
   ```
3. Expected: all stacks reach `CREATE_COMPLETE`; `outputs` shows a public IP; you can SSH into the server. Type `exit` to leave.

> 💸 **Cost control:** when you're done for the day and don't need it live, `scripts/deploy.sh destroy` deletes everything in reverse order (RDS keeps a final snapshot). Re-create anytime with `scripts/deploy.sh secrets init && scripts/deploy.sh infra up`.

---

### CR D3 — Release the application code

**Depends on:** D2, and backend through at least B1 (ideally B7) merged. **Branch off D2** (`cr/d3-release`).

**Goal:** put your actual backend + frontend onto the running server using the
**db** and **app** concerns (concerns 3–4).

Run **db** before **app** whenever a release changes the schema, so the new
columns exist before the new code serves traffic.

**Steps:**

**macOS / Linux**
```bash
cd ~/workspace/lt-parking-site-project
scripts/deploy.sh db migrate      # apply backend/webapp/sql/migrations/*.sql on the box
scripts/deploy.sh app all         # deploy backend, then build + ship the frontend
# or one part at a time:
scripts/deploy.sh app backend
scripts/deploy.sh app frontend
```

**Windows (PowerShell)** — these are bash scripts; run them via Git Bash/WSL:
```powershell
cd $HOME\workspace\lt-parking-site-project
bash scripts/deploy.sh db migrate
bash scripts/deploy.sh app all
# or one part at a time:
bash scripts/deploy.sh app backend
bash scripts/deploy.sh app frontend
```
What each does (so you understand it):
- **db migrate:** SSHes in as `ltride`, `git pull`, then applies every `backend/webapp/sql/migrations/*.sql` with `psql` (stops on the first error).
- **app backend:** SSHes in, `git pull`, reinstalls requirements, restarts the `ltride` service (gunicorn), and curls `/api/health`.
- **app frontend:** runs `npm run build` with the production API URL, then rsyncs `dist/` into nginx's web root and reloads nginx.

**Local testing guide:**
1. Setup: D2 done (`scripts/deploy.sh infra outputs` shows an IP); your code committed and pushed.
2. Steps:

   **macOS / Linux**
   ```bash
   scripts/deploy.sh db migrate
   scripts/deploy.sh app all
   curl http://<ElasticIp>/api/health
   ```

   **Windows (PowerShell)**
   ```powershell
   bash scripts/deploy.sh db migrate
   bash scripts/deploy.sh app all
   Invoke-RestMethod http://<ElasticIp>/api/health
   ```
   Then open `http://<ElasticIp>` (or your domain) in a browser and log in as a seeded student.
3. Expected: the health curl returns `{"data":{"status":"ok"}}`; the website loads; login works against the real server.

---

### CR D4 — Buy a domain, wire it to Route 53, and turn on HTTPS

**Depends on:** D3 (a working site reachable at `http://<ElasticIp>`). **Branch off D3** (`cr/d4-dns-tls`).

**Goal:** replace the bare IP with a real address like `https://ltride.example.com`, with a padlock (TLS).

> **The mental model — three separate things that must all line up:**
> 1. **Registrar** — the company you *buy* the domain name from (it's a yearly rental, ~$10–15/yr). Examples: Amazon Route 53, Namecheap, Cloudflare, Google Domains/Squarespace.
> 2. **DNS hosting (the "hosted zone")** — the phone book that maps your name → your server's IP. We use **AWS Route 53** for this so it lives next to the rest of our infrastructure.
> 3. **Nameservers (NS)** — the pointer that tells the *internet* "ask Route 53 for this domain's records." You set these **at the registrar**, pointing them at the Route 53 hosted zone. This is the step beginners miss.
>
> If you buy the domain **at Route 53**, steps 2 & 3 are automatic. If you buy it **elsewhere**, you must manually copy Route 53's nameservers back to the registrar. Both paths are below — **pick ONE**.

---

#### Step 0 — Choose where to buy the domain

| Option | When to pick it | Trade-off |
|---|---|---|
| **Buy at Route 53** (recommended here) | You want the simplest wiring; everything in AWS | Slightly pricier; pay via AWS bill |
| **Buy at a 3rd-party registrar** (Namecheap, Cloudflare, etc.) | You already have one, or want the cheapest price | You must hand-copy nameservers to Route 53 (Step 2B) |

Either way the **DNS records live in Route 53** — only *where you bought the name* differs.

---

#### Step 1 — Create a Route 53 hosted zone (both paths do this)

A "hosted zone" is the container in Route 53 that holds your domain's DNS records.

**Console way (easiest to see what's happening):**
1. AWS Console → **Route 53** → **Hosted zones** → **Create hosted zone**.
2. **Domain name:** your domain, e.g. `example.com` (use the *root* domain, even if your site will live at `ltride.example.com`).
3. **Type:** Public hosted zone → **Create**.
4. AWS immediately shows an **NS record** with **4 nameservers** like:
   ```
   ns-123.awsdns-45.com
   ns-678.awsdns-90.net
   ns-901.awsdns-12.org
   ns-234.awsdns-56.co.uk
   ```
   **Copy these four** — you need them in Step 2. Also copy the **Hosted zone ID** (looks like `Z0123456789ABCDEFGHIJ`).

**CLI way (equivalent):**

**macOS / Linux**
```bash
aws route53 create-hosted-zone --name example.com --caller-reference "ltride-$(date +%s)"
# then read the nameservers + zone id back:
aws route53 get-hosted-zone --id <HostedZoneId> --query 'DelegationSet.NameServers'
```

**Windows (PowerShell)** — same `aws` command; only the timestamp substitution differs:
```powershell
aws route53 create-hosted-zone --name example.com --caller-reference "ltride-$(Get-Date -UFormat %s)"
# then read the nameservers + zone id back:
aws route53 get-hosted-zone --id <HostedZoneId> --query 'DelegationSet.NameServers'
```

Put the Hosted zone ID into `deploy/params/prod.json` so the DNS stack and the `app` concern can find it:
```json
[
  "DomainName=ltride.example.com",
  "HostedZoneId=Z0123456789ABCDEFGHIJ",
  ...
]
```

---

#### Step 2A — If you bought the domain AT Route 53

Buying through Route 53 (**Route 53 → Registered domains → Register domains**) **auto-creates the hosted zone and auto-sets the nameservers** for you. There's nothing to copy — skip to Step 3. (If you did Step 1 manually *and* registered separately, make sure the registered domain points at the hosted zone you created; delete the duplicate zone if AWS made one.)

---

#### Step 2B — If you bought the domain ELSEWHERE (the nameserver hand-off)

This is the step that actually "connects" your purchased name to Route 53. You're telling your registrar: *"don't use your own DNS — delegate to these AWS nameservers."*

1. Log into your **registrar** (Namecheap / Cloudflare / GoDaddy / etc.).
2. Find the domain's **Nameservers** setting (often under "Domain" → "Nameservers" or "DNS"). Choose **Custom nameservers**.
3. **Delete** the registrar's default nameservers and **paste the 4 from Step 1** (no trailing dots needed; one per field):
   ```
   ns-123.awsdns-45.com
   ns-678.awsdns-90.net
   ns-901.awsdns-12.org
   ns-234.awsdns-56.co.uk
   ```
4. **Save.** Propagation usually takes minutes but can take **up to 24–48 hours**. Check progress:

   **macOS / Linux**
   ```bash
   dig NS example.com +short        # should eventually list the 4 awsdns nameservers
   ```

   **Windows (PowerShell)** — `dig` isn't native; use `Resolve-DnsName`:
   ```powershell
   Resolve-DnsName -Name example.com -Type NS   # should eventually list the 4 awsdns nameservers
   ```
   When the nameserver lookup shows the AWS nameservers, the hand-off is done — the internet now asks Route 53 for your domain.

> **Common mistake:** people add an "A record" at the registrar AND set Route 53 nameservers. Don't. Once you delegate nameservers to Route 53, the registrar's own DNS records are ignored — **all records go in Route 53** from now on (Step 3).

---

#### Step 3 — Point the domain at your server (A record in Route 53)

Now create the record that maps your name → your server's Elastic IP. Our `04-dns.yaml` stack does this from `params/prod.json`:
```bash
cd ~/workspace/lt-parking-site-project
scripts/deploy.sh infra up   # picks up 04-dns.yaml using DomainName + HostedZoneId
```
`04-dns.yaml` creates an **A record** `ltride.example.com → <ElasticIp>` (the Elastic IP from the compute stack, so it's stable across restarts).

**Or do it by hand** in the Console: Route 53 → your hosted zone → **Create record** → Record name `ltride` (or leave blank for the root), Type **A**, Value = your Elastic IP, TTL 300 → Create.

Verify:

**macOS / Linux**
```bash
dig ltride.example.com +short    # should print your Elastic IP
curl -I http://ltride.example.com/api/health   # should reach your server (200)
```

**Windows (PowerShell)**
```powershell
Resolve-DnsName -Name ltride.example.com -Type A     # should print your Elastic IP
Invoke-WebRequest -Uri http://ltride.example.com/api/health -Method Head   # should reach your server (200)
```

---

#### Step 4 — Update the app for the new hostname, then add HTTPS

1. **Tell the backend to trust the new origin.** Edit the server's `.env` `CORS_ORIGINS` to include `https://ltride.example.com`, then `sudo systemctl restart ltride`. (Locally you set this in `params`/`.env`; on the server it's in `/home/ltride/app/backend/.env`.)
2. **Rebuild the frontend** so it calls the domain, not the IP: `scripts/deploy.sh app frontend` already builds the UI with `VITE_API_URL=https://<DomainName>` when `DomainName` is set in `params/prod.json`. Re-run:
   ```bash
   scripts/deploy.sh app frontend
   ```
3. **Get a free TLS certificate** with certbot (Let's Encrypt). SSH in (native OpenSSH on Windows too —
   just `$HOME\.ssh\ltride-key.pem` for the key path) and run the same commands once connected:
   ```bash
   ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp>
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d ltride.example.com
   ```
   certbot edits the nginx config (File 1 from D1b): it adds a `listen 443 ssl` block, fills in `server_name ltride.example.com`, wires the certificate, and adds an **HTTP→HTTPS redirect**. It also installs a cron/timer to auto-renew every 90 days. Answer its prompts (email, agree to terms, choose "redirect").

---

**Local testing guide:**
1. Setup: hosted zone created (Step 1); nameservers delegated (Step 2, if 3rd-party) and `dig NS` shows AWS; A record live (Step 3); certbot run (Step 4).
2. Steps:

   **macOS / Linux**
   ```bash
   dig ltride.example.com +short                 # → your Elastic IP
   curl -I https://ltride.example.com/api/health # → HTTP/2 200, valid cert
   curl -I http://ltride.example.com             # → 301 redirect to https
   ```

   **Windows (PowerShell)**
   ```powershell
   Resolve-DnsName -Name ltride.example.com -Type A                          # → your Elastic IP
   Invoke-WebRequest -Uri https://ltride.example.com/api/health -Method Head # → 200, valid cert
   Invoke-WebRequest -Uri http://ltride.example.com -Method Head             # → 301 redirect to https
   ```
   Then open `https://ltride.example.com` in a browser and log in.
3. Expected:
   - `dig` resolves to your IP; the browser shows a **padlock** (valid Let's Encrypt cert).
   - Plain `http://` **redirects** to `https://`.
   - Login and the full app work over HTTPS (no CORS errors — because you added the https origin in Step 4.1).

**If something's wrong:**
- **`dig NS` doesn't show AWS nameservers** — Step 2B not done, or still propagating (wait; can take up to 48h). Until this resolves, nothing else will work.
- **`dig` shows the IP but the browser can't connect** — security group isn't allowing port 80/443 (check `01-network.yaml`), or nginx isn't running.
- **certbot fails "challenge failed"** — the domain must already resolve to this server over **port 80** before certbot can verify it. Finish Step 3 (and open port 80) first.
- **Padlock works but API calls fail with CORS** — you forgot Step 4.1 (`CORS_ORIGINS` must include the `https://` domain) or didn't restart the backend.

**Commit & push:**
```bash
git add deploy/params/prod.json deploy/cfn/04-dns.yaml
git commit -m "D4: Route 53 hosted zone + A record + HTTPS via certbot"
git push -u origin cr/d4-dns-tls
```
PR base = `cr/d3-release`.


---

## Part 2 — Operating & troubleshooting the live server

**Log into the server:**

**macOS / Linux**
```bash
ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp>
```

**Windows (PowerShell)** — native OpenSSH, same command:
```powershell
ssh -i $HOME\.ssh\ltride-key.pem ubuntu@<ElasticIp>
```

**Useful commands once you're on the server:**
```bash
sudo systemctl status ltride       # is the backend running?
sudo journalctl -u ltride -n 50    # last 50 lines of backend logs
sudo systemctl restart ltride      # restart the backend
sudo nginx -t && sudo systemctl reload nginx   # test + reload the web server
```

> **Where the config lives on the server** (created in **D1b**): nginx site at `/etc/nginx/sites-available/ltride` (→ symlinked into `sites-enabled/`), gunicorn service at `/etc/systemd/system/ltride.service`, app secrets at `/home/ltride/app/backend/.env`. After editing the nginx file run `sudo nginx -t && sudo systemctl reload nginx`; after editing the `.service` file run `sudo systemctl daemon-reload && sudo systemctl restart ltride`; after editing `.env` just `sudo systemctl restart ltride`.

**Common problems:**
- **`502 Bad Gateway` in the browser** — the backend (gunicorn) crashed; check `journalctl -u ltride`. Usually a missing env var or a DB connection error.
- **Website loads but API calls fail** — the frontend was built with the wrong `VITE_API_URL`; re-run `scripts/deploy.sh app frontend`.
- **Can't SSH** — your home IP changed; update `AdminCidr` in `params/prod.json` and `scripts/deploy.sh infra up`.
- **Database connection refused** — check the RDS endpoint and that the EC2 security group is allowed to reach RDS ([Part 3 §B.3–§B.4](#b3-network-stack-01-networkyaml)).


---

## Part 3 — Reference: architecture, IaC & cost model

> **What this is.** [Part 1](#part-1--deploy-to-aws-step-by-step-crs-d0d4) above is the *click-by-click* deployment tutorial. This part is the **reference/design** companion: the target architecture, the Infrastructure-as-Code layout, the CloudFormation snippets each stack is built from, the full AWS-services inventory, and the **cost model** (infrastructure + professional labor). The actual templates and scripts live in the repo-root [`deploy/`](../../deploy/README.md) folder. The orchestrator ([`../plan.md` §10](../plan.md#10-aws-deployment--ec2--rds-via-cloudformation)) links here as the authoritative deployment design.

**Architecture:** Flask served by **gunicorn** behind **nginx** on a single **EC2** instance; **PostgreSQL on RDS**; the React static bundle served from the same nginx (simplest) or from **S3 + CloudFront**. HTTPS via **Let's Encrypt (certbot)** on a domain managed in **Route 53**. **All infrastructure is provisioned and managed with AWS CloudFormation (IaC)** — no manual console clicks for the resources below.

```
                 ┌──────── EC2 t3.micro (Ubuntu 22.04, amd64) ────────┐
 Internet ──443──┤ nginx (TLS, reverse proxy, serves React build)      │
   (Route 53)    │   │                                                  │
                 │   └─ proxy /api ─▶ gunicorn (systemd) ─▶ Flask app   │
                 └───────────────────────────┬──────────────────────────┘
                                              │ 5432 (private SG)
                                     ┌────────▼─────────┐
                                     │ RDS PostgreSQL   │
                                     └──────────────────┘
```

### B.1 Prerequisites
- AWS account with admin/IAM access; AWS CLI configured locally (`aws configure`).
- A registered domain with a **Route 53 hosted zone** (note its `HostedZoneId`).
- Backend prepared per CRs **B0–B10** (B10 = Postgres-ready connection layer).
- A fresh EC2 **key pair** created once (`aws ec2 create-key-pair`), referenced by name as a stack parameter (**not** the leaked `aws-tutorial.pem`).
- The RDS master password stored in **AWS Secrets Manager** (CloudFormation references it dynamically; it is never written into the template or git).

### B.2 IaC layout
The CloudFormation templates + on-server config live under `deploy/`; the runnable orchestration lives under `scripts/`, split into four concerns behind one entrypoint:
```
deploy/
  cfn/
    00-secrets.yaml     # Secrets Manager: ltride/db + ltride/app (deploy FIRST)
    01-network.yaml     # VPC, 2 public subnets across 2 AZs, IGW, route tables, SGs
    02-database.yaml    # RDS PostgreSQL, DB subnet group (resolves creds from ltride/db)
    03-compute.yaml     # EC2 + Elastic IP + IAM instance role, UserData bootstrap
    04-dns.yaml         # Route 53 A record → Elastic IP
  params/
    prod.json           # stack parameters (instance type, domain, key name, ...)
  server/               # files installed on the box (nginx conf, systemd unit, provision.sh)
scripts/
  deploy.sh             # single entrypoint: deploy.sh <concern> <subcommand>
  deploy-secrets.sh     # concern 1: Secrets Manager
  deploy-infra.sh       # concern 2: CloudFormation stacks, in dependency order
  deploy-db.sh          # concern 3: SQL migrations (over SSH, on the box)
  deploy-app.sh         # concern 4: ship backend + frontend code
  lib/deploy-common.sh  # shared helpers (env, AWS wrappers, stack/secret/SSH resolvers)
```
**`scripts/deploy.sh <concern> <subcommand>`** is the one entrypoint. It sources optional AWS credentials from `scripts/aws-credential.sh` (gitignored) and verifies them with `sts get-caller-identity` before any change, then dispatches to the concern:

**macOS / Linux**
```bash
scripts/deploy.sh all               # guided end-to-end: secrets → infra → db → app
scripts/deploy.sh secrets init      # concern 1: create ltride/db + ltride/app
scripts/deploy.sh infra up          # concern 2: create/update all stacks in order
scripts/deploy.sh infra validate    # validate templates only, no changes
scripts/deploy.sh infra status      # show each stack's status
scripts/deploy.sh infra outputs     # print each stack's Outputs
scripts/deploy.sh db migrate        # concern 3: apply backend/webapp/sql/migrations/*.sql
scripts/deploy.sh app all           # concern 4: deploy backend, then frontend
scripts/deploy.sh destroy           # guided teardown, reverse order (DB leaves a snapshot)
```

**Windows (PowerShell)** — these are bash scripts; run them via Git Bash/WSL:
```powershell
bash scripts/deploy.sh all
bash scripts/deploy.sh infra up
bash scripts/deploy.sh app all
```
Region comes from `AWS_REGION` (default `us-east-1`); `-e/--env <name>` selects `params/<name>.json` (default `prod`). Stack names stay `ltride-<suffix>` (one environment per account/region). Cross-stack wiring uses `Outputs` + `Fn::ImportValue` (e.g. the secrets stack exports `ltride-DbSecretArn`/`ltride-AppSecretArn`, network exports `ltride-VpcId`/`ltride-WebSecurityGroupId`/`ltride-DbSecurityGroupId`, database exports `ltride-DbEndpoint`).

### B.3 Network stack (`01-network.yaml`)
Provisions: a VPC (`10.0.0.0/16`), **two public subnets across two AZs** (RDS requires a subnet group spanning ≥ 2 AZs; there are **no** private subnets — the database is isolated by security group, not by subnet placement), an Internet Gateway + public route table, and two security groups:
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

### B.4 Database stack (`02-database.yaml`)
Provisions a DB subnet group across two subnets and the RDS instance; `MasterUsername`/`MasterUserPassword` are resolved from the `ltride/db` secret at deploy time — never in plaintext.

> **The snippet below is illustrative** (shows the resolve-from-secret shape). In the **actual** templates the secret is created by `00-secrets.yaml` (concern 1), *not* here — this stack only consumes `ltride/db` by name. Read the real files: [`deploy/cfn/00-secrets.yaml`](../../deploy/cfn/00-secrets.yaml) and [`deploy/cfn/02-database.yaml`](../../deploy/cfn/02-database.yaml).

```yaml
  # The ltride/db secret is created by 00-secrets.yaml (concern 1) with username
  # "ltride" + a generated password; this stack only CONSUMES it by name.
  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    Properties:
      Engine: postgres
      EngineVersion: "16"
      DBInstanceClass: !Ref DbInstanceClass     # db.t3.micro (free tier)
      AllocatedStorage: "20"
      StorageType: gp3
      DBName: ltride
      MasterUsername: '{{resolve:secretsmanager:ltride/db:SecretString:username}}'      # "ltride"
      MasterUserPassword: '{{resolve:secretsmanager:ltride/db:SecretString:password}}'
      DBSubnetGroupName: !Ref DbSubnetGroup
      VPCSecurityGroups: [ !ImportValue ltride-DbSecurityGroupId ]
      PubliclyAccessible: false
      BackupRetentionPeriod: 7
      MultiAZ: false
    # Outputs: DB endpoint address (ltride-DbEndpoint), consumed by compute UserData
```

### B.5 Compute stack (`03-compute.yaml`) — EC2 + bootstrap
Provisions an Elastic IP, an IAM instance role (read the two `ltride/*` secrets), and the EC2 instance whose **`UserData`** bootstraps the server on first boot — so the box is reproducible from the template, not hand-configured. UserData performs the same steps that were previously manual.

> **The snippet below is illustrative.** The **actual** [`deploy/cfn/03-compute.yaml`](../../deploy/cfn/03-compute.yaml) clones the monorepo (`lt-parking-site-project`), builds the venv under `backend/`, writes `backend/.env` with the DB creds from `ltride/db` and `SECRET_KEY` from `ltride/app`, and runs gunicorn as `webapp.App:app` from `backend/`. Read the real file for the exact commands.

```yaml
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref UbuntuAmi             # SSM-resolved Ubuntu 22.04 AMI (amd64)
      InstanceType: !Ref WebInstanceType  # default t3.micro (2 vCPU, 1 GiB, amd64; free-tier eligible)
      KeyName: !Ref KeyName
      IamInstanceProfile: !Ref InstanceProfile
      SubnetId: !ImportValue ltride-PublicSubnet1
      SecurityGroupIds: [ !ImportValue ltride-WebSecurityGroupId ]
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash -xe
          apt update && apt install -y python3-venv nginx postgresql-client git jq
          useradd -m -s /bin/bash ltride
          # Clone the whole MONOREPO; the Flask backend is the backend/ subtree.
          sudo -u ltride git clone https://github.com/LTRide2/lt-parking-site-project.git /home/ltride/app
          sudo -u ltride python3 -m venv /home/ltride/app/backend/.venv
          sudo -u ltride /home/ltride/app/backend/.venv/bin/pip install -r /home/ltride/app/backend/webapp/requirements.txt gunicorn psycopg2-binary
          # Pull DB creds from ltride/db and the Flask key from ltride/app; write backend/.env
          DB=$(aws secretsmanager get-secret-value --secret-id ltride/db  --query SecretString --output text --region ${AWS::Region})
          APP=$(aws secretsmanager get-secret-value --secret-id ltride/app --query SecretString --output text --region ${AWS::Region})
          USER=$(echo "$DB" | jq -r .username); PW=$(echo "$DB" | jq -r .password)
          KEY=$(echo "$APP" | jq -r .secret_key)
          cat >/home/ltride/app/backend/.env <<ENV
          FLASK_ENV=production
          SECRET_KEY=$KEY
          DATABASE_URL=postgresql://$USER:$PW@${DbEndpoint}:5432/ltride
          CORS_ORIGINS=https://${DomainName}
          ENV
          chmod 600 /home/ltride/app/backend/.env && chown ltride:ltride /home/ltride/app/backend/.env
          # Apply migrations + seed, then install services (see B.6–B.9)
          sudo -u ltride bash -c 'cd /home/ltride/app/backend; set -a; . .env; for f in webapp/sql/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done; psql "$DATABASE_URL" -f webapp/sql/seed.sql'
          # ... systemd unit + nginx config installed here (B.6/B.8) ...
```

`DbEndpoint` and `DomainName` are passed in as parameters from the database/DNS stack outputs. The instance role grants `secretsmanager:GetSecretValue` on exactly the two secrets `ltride/db` and `ltride/app` — nothing else.

### B.6 gunicorn as a systemd service
The UserData (B.5) writes this unit. It is shown standalone for clarity / manual ops:
`/etc/systemd/system/ltride.service`:
```ini
[Unit]
Description=LTRide Flask API
After=network.target

[Service]
User=ltride
Group=www-data
WorkingDirectory=/home/ltride/app/backend
EnvironmentFile=/home/ltride/app/backend/.env
ExecStart=/home/ltride/app/backend/.venv/bin/gunicorn \
    --workers 3 --bind 127.0.0.1:8000 webapp.App:app
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

### B.7 Build & place the frontend
The SPA build is an app artifact, not infrastructure, so it stays a CI step. On your machine (or in CI): `VITE_API_URL=https://<your-domain> npm run build` → produces `dist/`. Copy it to the server:
```bash
rsync -avz -e "ssh -i ltride-key.pem" dist/ ubuntu@<elastic-ip>:/tmp/dist/
sudo mkdir -p /var/www/ltride && sudo cp -r /tmp/dist/* /var/www/ltride/
```
> **Windows note:** `rsync` isn't available natively; run the `rsync` line from Git Bash/WSL, or
> substitute `scp -i ltride-key.pem -r dist\* ubuntu@<elastic-ip>:/tmp/dist/` (native OpenSSH `scp`
> works the same as macOS/Linux). The `sudo mkdir`/`cp` line runs on the server either way.
*(Alternative: a separate CloudFormation stack provisions an S3 bucket + CloudFront distribution; CI syncs `dist/` to S3 and invalidates the cache. nginx then only proxies `/api`.)* The frontend-side build/serve details also live in the [UI guide's Deployment section](https://github.com/LTRide2/lt-parking-site-project/blob/main/plan/ui/ui-development-guide.md#part-f3--deployment-frontend).

### B.8 nginx reverse proxy + SPA
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

### B.9 DNS + HTTPS
- **DNS** is managed by the **DNS stack (`04-dns.yaml`)**: an `AWS::Route53::RecordSet` (A record) in the hosted zone pointing at the Elastic IP exported by the compute stack.
```yaml
  ApiRecord:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: !Ref HostedZoneId
      Name: !Ref DomainName
      Type: A
      TTL: "300"
      ResourceRecords: [ !ImportValue ltride-ElasticIp ]
```
- **TLS** is obtained on the box via certbot (one-time, can run from UserData after DNS resolves):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain> --non-interactive --agree-tos -m admin@<your-domain>
sudo systemctl status certbot.timer   # auto-renewal enabled
```
*(For fully-managed certs without certbot, front the instance with an ALB + ACM certificate in a future stack revision.)*

### B.10 Deploy / update workflow
**Infrastructure changes** go through the **infra** concern — edit the template, then apply (it updates in place):

**macOS / Linux**
```bash
scripts/deploy.sh infra up            # create/update all stacks in dependency order
scripts/deploy.sh infra status        # per-stack status
```
Under the hood this runs `aws cloudformation deploy` per stack, adding `CAPABILITY_NAMED_IAM` only for the compute stack (which names its IAM role).

**Schema changes** go through the **db** concern (run it *before* shipping code that needs the new columns):
```bash
scripts/deploy.sh db migrate          # apply backend/webapp/sql/migrations/*.sql on the box
```

**Application changes** (code, not infra) go through the **app** concern, which resolves the EC2 host from the compute stack outputs and deploys over SSH:

**macOS / Linux**
```bash
scripts/deploy.sh app all             # deploy backend then frontend
scripts/deploy.sh app backend         # backend only: git pull + pip install + restart gunicorn + health check
scripts/deploy.sh app frontend        # frontend only: npm build (prod VITE_API_URL) + rsync dist/ to nginx
```

**Windows (PowerShell)** — these are bash scripts; run them via Git Bash/WSL:
```powershell
bash scripts/deploy.sh app all
bash scripts/deploy.sh app backend
bash scripts/deploy.sh app frontend
```
It reads the SSH key from `~/.ssh/<KeyName>.pem` (override with `SSH_KEY`), builds the UI from the repo's `frontend/` pointing at `https://<DomainName>`, restarts gunicorn, and verifies `/api/health` before finishing.

The equivalent **manual steps** (useful for debugging on the box) remain:
```bash
# backend — on the server, as ltride (monorepo cloned at /home/ltride/app)
cd /home/ltride/app && git pull
cd backend && .venv/bin/pip install -r webapp/requirements.txt
set -a; . .env; set +a
psql "$DATABASE_URL" -f webapp/sql/migrations/<new>.sql   # if schema changed
sudo systemctl restart ltride
# frontend — rebuild locally, rsync dist/ (or S3 sync), no service restart needed
```
**CI/CD (CR D2):** a GitHub Actions workflow on push to `main` can run `scripts/deploy.sh infra up` for infra changes, then `scripts/deploy.sh db migrate` and `scripts/deploy.sh app all` to deploy the application code.

### B.11 Operations & hardening
- **Backups:** RDS `BackupRetentionPeriod: 7` is set in the template; `DeletionPolicy: Snapshot` prevents data loss if the DB stack is deleted.
- **Logs:** `journalctl -u ltride -f` (app), `/var/log/nginx/` (web). Logs stay **on the box** — the instance IAM role is scoped to `secretsmanager:GetSecretValue` on the two secrets only, and grants **no** CloudWatch Logs access. Shipping logs to CloudWatch (install the agent + add `logs:*` to the role) is a deferred hardening step, not currently provisioned.
- **Monitoring:** none is provisioned today. A hardening pass would add `AWS::CloudWatch::Alarm` resources (EC2 CPU, RDS free storage/connections) to the relevant stacks so alarms are version-controlled too.
- **Security:** SSH (`22`) restricted to `AdminCidr` in the template; secrets live only in Secrets Manager; `.env` is generated on-box (never in git); run `unattended-upgrades`.
- **Teardown:** `aws cloudformation delete-stack` in reverse order (dns → compute → database → network) cleanly removes everything (DB leaves a final snapshot).
- **Cost:** the shipped templates default the web tier to **`t3.micro`** (free-tier eligible) and RDS to **`db.t3.micro`**, so a default deploy runs at/near free-tier. §B.13 costs the **scale-up scenarios** (e.g. a `c6g.4xlarge` sized for ~1000 concurrent users) you opt into by raising `WebInstanceType`/`DbInstanceClass` — not the default. Elastic IP is free while associated with a running instance.

### B.12 Deployment diagram — all AWS services

Every AWS resource the plan provisions, grouped by CloudFormation stack. Solid arrows are the request/data path; dashed arrows are provisioning/read-at-deploy dependencies. The **S3 + CloudFront** path is the optional alternative to nginx-served static files (§B.7).

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
                subgraph ec2box["03-compute stack — EC2 t3.micro<br/>(Ubuntu 22.04, amd64)"]
                    nginx["nginx<br/>(TLS via certbot, reverse proxy,<br/>serves React build)"]
                    gunicorn["gunicorn + Flask API<br/>(systemd service)"]
                end

                subgraph dbsub["DB subnet group (2 public AZs)<br/>RDS isolated by security group"]
                    rds[("02-database stack<br/>RDS PostgreSQL db.t3.micro<br/>(PubliclyAccessible: false)")]
                end
            end

            websg{{"WebSecurityGroup<br/>80/443 from 0.0.0.0/0<br/>22 from AdminCidr"}}
            dbsg{{"DbSecurityGroup<br/>5432 from WebSecurityGroup only"}}
        end

        secrets["Secrets Manager<br/>ltride/db + ltride/app"]
        iamrole["IAM instance role<br/>+ instance profile"]
        cwlogs["CloudWatch Logs + Alarms<br/>(deferred — not provisioned)"]
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
    iamrole -->|GetSecretValue on ltride/db + ltride/app| secrets
    gunicorn -.->|reads DB creds at boot| secrets
    ec2box -.->|logs stay on box; CW shipping deferred| cwlogs
    rds -.->|master creds| secrets

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
| VPC, subnets, Internet Gateway, route tables | `01-network` | Network isolation: **2 public subnets across 2 AZs** (no private subnets; RDS isolated by SG) |
| Security Groups (Web, Db) | `01-network` | Firewall: web tier open on 80/443 (22 from AdminCidr); DB reachable only from the web SG |
| EC2 (`t3.micro` default, Ubuntu 22.04 amd64) | `03-compute` | Runs nginx + gunicorn/Flask; bootstrapped via UserData (`WebInstanceType` is a parameter — size up for load, see §B.13) |
| Elastic IP | `03-compute` | Stable public address bound to the EC2 instance |
| IAM role + instance profile | `03-compute` | Grants EC2 `secretsmanager:GetSecretValue` on `ltride/db` + `ltride/app` **only** (no CloudWatch Logs) |
| RDS PostgreSQL (db.t3.micro) | `02-database` | Managed database in the DB subnet group (public AZs), not publicly accessible; 7-day backups, Snapshot on delete |
| Secrets Manager (`ltride/db`, `ltride/app`) | `00-secrets` | Auto-generated RDS credentials + Flask `SECRET_KEY`; read by EC2 at boot |
| Route 53 | `04-dns` | Hosted zone + A record → Elastic IP |
| CloudWatch Logs (+ Alarms) | *(deferred)* | Not provisioned today; a hardening pass would add log shipping + EC2/RDS alarms |
| S3 + CloudFront *(optional)* | future stack | Alternative static hosting for the React build instead of nginx |

### B.13 Monthly cost estimate (scaling scenarios)

**Assumptions:** region **us-east-1**, **on-demand** list prices, **730 hrs/month** (24×7), single-AZ RDS. Prices are AWS list rates and exclude taxes; actual bills vary by region, usage, and any Savings Plans/Reserved Instances.

> ⚠️ **The shipped templates default to `t3.micro` + `db.t3.micro` (free-tier eligible)** — a default deploy costs at/near **$0** for the first year and single-digit dollars after. The breakdown below prices a **scale-up scenario** you opt into by raising `WebInstanceType`/`DbInstanceClass` in `params/prod.json`: a **c6g.4xlarge** (16 vCPU / 32 GiB) web tier sized for ~1000 concurrent users, where EC2 becomes the dominant cost. **This is not what deploys by default.**

| Line item | Spec | Unit price | Qty / month | Monthly cost |
|---|---|---|---|---|
| EC2 web server | c6g.4xlarge (16 vCPU, 32 GiB) | $0.544 / hr | 730 hrs | **$397.12** |
| EC2 root volume | EBS gp3, ~30 GB (assumed) | $0.08 / GB-mo | 30 GB | $2.40 |
| RDS instance | db.t3.micro PostgreSQL, single-AZ | $0.017 / hr | 730 hrs | $12.41 |
| RDS storage | gp3, 20 GB | $0.115 / GB-mo | 20 GB | $2.30 |
| RDS backups | 7-day retention (≤ DB size) | included | — | ~$0.00 |
| Secrets Manager | 2 secrets (`ltride/db`, `ltride/app`) | $0.40 / secret-mo | 2 | $0.80 |
| Route 53 | 1 hosted zone | $0.50 / zone-mo | 1 | $0.50 |
| CloudWatch Logs | low-volume app/web logs (est.) | $0.50 / GB ingest | ~1–2 GB | ~$1.00 |
| Elastic IP | attached to running instance | free while attached | 1 | $0.00 |
| Data transfer out | first 100 GB/mo free | $0.09 / GB after | < 100 GB | $0.00 |
| Domain registration | `.com` via Route 53, ~$13/yr amortized | $13 / yr | 1/12 | $1.08 |
| **Total** | | | | **≈ $417.61 / month** |

*(The table above is the **scale-up "mid"** scenario — a c6g.4xlarge on-demand web tier + single-AZ db.t3.micro — **not** the default deploy. The templates ship `t3.micro`, which lands at/near the free tier; see the Minimum column below.)*

#### Minimum / mid / maximum monthly scenarios — sized for ~1000 concurrent users

**Load assumption: ~1000 concurrent users.** This is real production traffic, and it changes what each tier means: the total swings mostly with **EC2 size + count**, **RDS tier + HA**, **egress traffic** (1000 users pull real data), and whether a **load balancer** fronts the app. Three planning scenarios (all us-east-1, on-demand unless noted, 730 hrs/mo):

| Cost driver | **Default / Minimum** (as shipped, demo) | **Mid** (scale-up, sized for load) | **Maximum** (HA production) |
|---|---|---|---|
| Load balancer (ALB) | — (none) | — (single instance) | ALB + LCUs — $22.00 |
| EC2 web tier | **`t3.micro` (default, 2 vCPU/1 GiB) — $7.59** ($0 under 12-mo free tier) | **c6g.4xlarge (16 vCPU/32 GiB) — $397.12** | 2× c6g.4xlarge — $794.24 |
| EC2 root volume | AMI-default gp2 ~8 GB — ~$0.80 | gp3 30 GB — $2.40 | 2× gp3 30 GB — $4.80 |
| RDS instance | db.t3.micro single-AZ — $12.41 | db.t3.medium single-AZ — $49.64 | db.t3.large Multi-AZ — $198.56 |
| RDS storage | gp3 20 GB — $2.30 | gp3 50 GB — $5.75 | gp3 100 GB — $11.50 |
| Secrets Manager | $0.80 | $0.80 | $0.80 |
| Route 53 (zone + queries) | $0.50 | $1.00 | $2.00 |
| CloudWatch Logs (+ Alarms) | $0.00 (not provisioned) | $5.00 | $15.00 |
| S3 + CloudFront (frontend) | — (nginx-served) | — (nginx-served) | ~$10.00 |
| Data transfer out | $0.00 (demo, < 100 GB free) | ~$18.00 (≈300 GB) | ~$70.00 (≈900 GB, via CloudFront) |
| Domain registration (amortized) | $1.08 | $1.08 | $1.08 |
| **AWS monthly total** | **≈ $25.48** (≈ $2.40 under 12-mo free tier — only Secrets Manager, Route 53 + domain aren't covered) | **≈ $480.79** | **≈ $1,127.98** |

**Why each tier costs what it does:**

- **Default / Minimum — ≈ $25/mo (≈ $2/mo under the 12-month free tier; DEMO/SMALL-SCALE, does *not* serve 1000 concurrent users).** This is **what the templates deploy out of the box**: the default `t3.micro` web instance, a free-tier-class `db.t3.micro`, nginx serving the static files, and near-zero traffic (under the 100 GB/mo free egress). It is deliberately small — a `t3.micro` and a `db.t3.micro` would saturate CPU and exhaust DB connections well before 1000 concurrent users, and with a single instance any reboot is downtime. **This is the right tier for a demo, dev, class-presentation, or small real deployment — but not for the stated 1000-user load.**

- **Mid — ≈ $481/mo (a scale-up sized to actually carry 1000 users; NOT the default).** Raising `WebInstanceType` to a single `c6g.4xlarge` (16 vCPU / 32 GiB) — its 16 cores run enough gunicorn workers to handle 1000 concurrent users of a lightweight API, and EC2 is by far the dominant line ($397). The DB is bumped from `db.t3.micro` to **`db.t3.medium`** because a micro can't hold the connection pool 1000 users generate. Real egress (~300 GB) now costs ~$18 since the free 100 GB is exceeded, and logging rises with traffic. The trade-off: **one instance = one point of failure** — a crash or reboot is an outage until it restarts.

- **Maximum — ≈ $1,128/mo (highly-available production).** This removes the single point of failure and adds headroom: an **ALB** spreads traffic across **two `c6g.4xlarge` instances** (so one can fail or be redeployed with no downtime), and RDS moves to a **Multi-AZ `db.t3.large`** with a hot standby in a second AZ. Static assets move to **S3 + CloudFront** (cheaper, faster egress at scale), egress rises to ~900 GB (~$70), and CloudWatch alarms/logs are fully on. This is what you'd run if the parking system were business-critical during a rush (e.g. start-of-semester).

> **Reserved capacity discount:** committing the `c6g.4xlarge` fleet to a **1-year Compute Savings Plan** (~$0.34/hr vs $0.544 on-demand) cuts each instance ~37% — bringing **mid ≈ $332** and **max ≈ $832**.

**Cost-reduction levers:**
- **Stay on the default `t3.micro`** unless measured load demands more — the c6g.4xlarge in the mid/max scenarios is far larger than a small Flask API needs and only makes sense at real 1000-user load. Size up to measured load, not ahead of it.
- A **1-year Compute Savings Plan / Reserved Instance** cuts the EC2 rate ~30–60% (≈ $160–280/mo for the c6g.4xlarge line) if you do scale up.
- Optional **S3 + CloudFront** frontend hosting (§B.7) adds a few dollars/month but offloads static traffic from EC2.

### B.14 Actual professional costs (contractor build + maintenance)

The AWS figures above (§B.13) are **infrastructure only**. This section estimates the **professional software engineering cost** to actually build, deliver, and maintain the system — labor, not cloud bills.

**Assumptions:** US-based independent contractor / small agency, **blended rate $125/hr** (mid–senior full-stack; typical market range $100–160/hr). Effort is scoped from the CR plan in [`../plan.md` §8](../plan.md#8-implementation-strategy-stacked-crs) (B0–B10, U0–U9, D1–D4). One-time build is a project fee; maintenance is an ongoing monthly retainer **separate from AWS costs**.

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

Ongoing engineering support after launch — bug fixes, security patching, dependency upgrades, small feature requests, and monitoring/on-call. Priced as a retainer, independent of the AWS bill in §B.13.

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
| AWS infrastructure (§B.13, mid tier sized for 1000 users, incl. domain) | ≈ $480 |
| Professional maintenance (labor, above) | ≈ $2,000 |
| **Total monthly run-rate** | **≈ $2,480 / month** |

> **Year-one total of ownership** (one-time build + 12× combined run-rate) ≈ **$38,750 + $29,760 ≈ $68,510**. These are planning estimates at a $125/hr blended rate and the mid AWS tier — adjust for the actual contractor rate, region, chosen AWS tier, and negotiated scope.
