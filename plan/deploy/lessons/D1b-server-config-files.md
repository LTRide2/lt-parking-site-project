# Lesson D1b — Server configuration files (nginx, gunicorn/systemd, provisioning)

> **Track:** Deploy · **Lesson 3 of 6**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (three new file formats — nginx, systemd, bash — but each one is short and explained line by line).
> **🧩 Prerequisites:** you've done [Lesson D1 — Write the CloudFormation templates](D1-cloudformation-templates.md) (the four `deploy/cfn/*.yaml` files all pass `./deploy.sh validate`).
> **🌿 CR branch:** `cr/d1b-server-config` (off `cr/d1-cfn-templates`) · **📄 Source CR:** [deployment guide → CR D1b](../deployment-guide.md#cr-d1b--server-configuration-files-nginx-gunicornsystemd-provisioning) · **🗺 Big picture:** [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation)

---

## 🎯 Goal — what you'll have at the end

The three files that turn a bare Ubuntu box into a working LTRide server, all living in `deploy/server/`. The CloudFormation compute stack (D1's `03-compute.yaml`) runs their logic automatically on first boot via **UserData** — but you also need them as real files so you (or a script) can re-provision or fix a server by hand.

**✅ Done when (your deliverable checklist):**
- [ ] `deploy/server/nginx-ltride.conf` exists: listens on port 80, serves the React build from `/var/www/ltride`, has the SPA `try_files` fallback, and reverse-proxies `/api/` to `127.0.0.1:8000`.
- [ ] `deploy/server/ltride.service` exists: a systemd unit that runs gunicorn as the unprivileged `ltride` user, bound to `127.0.0.1:8000`, with `Restart=always`.
- [ ] `deploy/server/provision.sh` exists, with `REPO_URL` set to your repo's clone URL, and `bash -n provision.sh` reports no syntax errors.
- [ ] Your work is committed on branch `cr/d1b-server-config` and pushed, PR base = `cr/d1-cfn-templates`.

---

## 🤔 Why this lesson matters

Right now your CloudFormation templates (D1) describe an EC2 box, but an empty box doesn't run anything. Something has to (1) actually serve your React files and API to the internet, and (2) keep the Flask app itself alive when it inevitably crashes at 2am. That's the job of these three files:

- **nginx** is the *only* thing exposed to the internet. It wears two hats: a static file server (for the React build) and a **reverse proxy** — it quietly forwards anything under `/api/` to your Flask app, which never talks to the internet directly. One hardened front door instead of two.
- **systemd** is Linux's "keep this program running" manager. gunicorn (the process that actually runs your Flask app) *will* crash occasionally — a bad request, an out-of-memory moment, a server reboot. Without systemd watching it, that crash means your site is down until a human notices and restarts it by hand. With it, the app comes back in 3 seconds, automatically, forever.

The request journey looks like this:

```
Browser ──HTTP(S)──▶ nginx :80/:443 ──┬─ /…       → serve files from /var/www/ltride (the React app)
                                       └─ /api/…   → proxy to gunicorn 127.0.0.1:8000 → Flask → RDS
```

nginx is the only thing exposed to the internet. gunicorn listens on `127.0.0.1` (localhost) only, so the API can't be reached except *through* nginx. Get this pair right once, and every later deploy (D2–D4) just reuses it.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **nginx** | A web server that can serve static files and forward requests to other programs. | [nginx docs](https://nginx.org/en/docs/) |
| **Reverse proxy** | A server that sits in front of your app and forwards requests to it, hiding it from direct internet access. | [nginx: reverse proxy guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) |
| **gunicorn** | The production server that actually runs your Flask app (Flask's own dev server isn't safe for real traffic). | [gunicorn docs](https://docs.gunicorn.org/en/stable/) |
| **systemd unit** | A config file that teaches Linux how to start, stop, and restart a program automatically. | [systemd.service(5) man page](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) |
| **SPA fallback (`try_files`)** | An nginx rule that serves `index.html` for any URL that isn't a real file, so client-side routing (React Router) works on refresh/deep-link. | [nginx `try_files` docs](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files) |
| **WSGI** | The standard interface Python web servers (gunicorn) use to talk to Python web apps (Flask). | [PEP 3333 — WSGI](https://peps.python.org/pep-3333/) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → the request journey (5) → nginx config (15) → systemd unit (15) → provisioning script (10) → test & commit (10).

**Open your terminal and branch off D1** — D1b depends on D1's CloudFormation templates, so it stacks on top of that branch, not `main`:

```bash
source .venv/bin/activate           # your prompt should now start with (.venv)
git checkout cr/d1-cfn-templates
git pull                            # make sure you start from the latest D1 branch
git checkout -b cr/d1b-server-config   # create + switch to this lesson's branch
```

**What this does & why:** because D1b's files depend on D1's templates existing (the compute stack's UserData runs this CR's logic), the branch stacks on `cr/d1-cfn-templates` instead of `main`, matching the [stacked-CR workflow](../../plan.md#8-implementation-strategy-stacked-crs). → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Understand the request journey (~5 min)

Before writing any config, look again at the diagram above. Every request from a browser hits **nginx first, and only nginx** — that's the whole point of a reverse proxy: gunicorn (your Flask app) never listens on a public IP, so it literally cannot be reached except through nginx. Keep this mental model while you write Steps 2 and 3: nginx's job is "public door," systemd/gunicorn's job is "keep the app behind that door alive."

### Step 2 — Write the nginx reverse-proxy + static-file config (~15 min)

Create `deploy/server/nginx-ltride.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;                 # matches any hostname (until a domain + certbot set a real one)

    client_max_body_size 10M;      # allow map-image uploads (nginx default is 1M → 413 errors)

    root /var/www/ltride;          # where release.sh puts the built React files
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

**Explanation, line by line:**
- **`server_name _;`** — `_` is nginx's "match any hostname." Fine when you only reach the box by IP; once you add a domain, `certbot` (lesson D4) edits this to your real name so it can issue a certificate for it.
- **`client_max_body_size 10M;`** — nginx rejects request bodies over **1 MB by default** with `413 Request Entity Too Large`. Map uploads need more, so we raise it. This is the single most common "works locally, 413 in the cloud" gotcha.
- **`root` + `index`** — where the static React files live and the default file to serve.
- **`location / { try_files $uri $uri/ /index.html; }`** — the **SPA fallback**. React Router invents URLs like `/admin` that aren't files on disk. `try_files` tries the literal file, then a folder, and **falls back to `index.html`** so the React app boots and routes the URL itself. Without this, refreshing `/admin` returns a 404. → Reference: [nginx `try_files`](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).
- **`location /assets/ { expires 1y; immutable }`** — Vite fingerprints bundle filenames with a hash, so a new deploy = a new filename. That makes it safe to tell browsers to cache them forever; users still get new code instantly because the filename changed.
- **`location /api/ { proxy_pass … }`** — the **reverse proxy**. Everything under `/api/` is forwarded to gunicorn on `127.0.0.1:8000`. The `proxy_set_header` lines pass the *real* visitor's host/IP/scheme through to Flask (otherwise your logs would just show `127.0.0.1`, i.e. nginx talking to itself). `X-Forwarded-Proto` tells Flask whether the original request was http or https. → Reference: [nginx reverse proxy guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/).

### Step 3 — Write the systemd unit so gunicorn survives crashes and reboots (~15 min)

Create `deploy/server/ltride.service`:

```ini
[Unit]
Description=LTRide backend (gunicorn)
After=network.target

[Service]
User=ltride
Group=ltride
WorkingDirectory=/home/ltride/app
EnvironmentFile=/home/ltride/app/.env
ExecStart=/home/ltride/app/.venv/bin/gunicorn \
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
- **`EnvironmentFile=…/.env`** — the production secrets (`SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`). This is the server's equivalent of your local `.env` from [Lesson B0](https://github.com/LTRide2/LTR-Backend/blob/main/plan/backend/lessons/B0-clean-slate-and-safety.md) — it lives only on the box, readable only by `ltride`, never committed.
- **`ExecStart=…/gunicorn …`** — the actual command. Uses the **venv's** gunicorn (not system Python). `--workers 3` runs 3 processes for concurrency (rule of thumb: `2 × CPU + 1`). `--bind 127.0.0.1:8000` = listen on localhost only (nginx is the public door). `webapp.App:app` = import module `webapp.App`, use the object `app` — this is **WSGI**, the standard hookup between gunicorn and Flask. → Reference: [WSGI (PEP 3333)](https://peps.python.org/pep-3333/), [gunicorn docs](https://docs.gunicorn.org/en/stable/). The `-` logfiles send logs to the journal so `journalctl` can show them.
- **`Restart=always` / `RestartSec=3`** — if gunicorn dies, systemd restarts it after 3s. Survives crashes and reboots. → Reference: [systemd.service man page](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html).
- **`WantedBy=multi-user.target`** — lets `systemctl enable ltride` make it start automatically on every boot.

**Operating it** (once it's actually on a server, in a later lesson):
```bash
sudo systemctl status ltride        # active (running)?
sudo journalctl -u ltride -n 50     # last 50 log lines (your #1 debugging tool)
sudo systemctl restart ltride       # apply a config/code change
sudo systemctl daemon-reload        # after EDITING the .service file itself
```

### Step 4 — Write the provisioning script that ties it together (~10 min)

Create `deploy/server/provision.sh`. This is what `03-compute.yaml`'s UserData runs (roughly) on a fresh instance, and what you can run by hand to (re)build a box. In order, it should:

1. `apt-get install` python, nginx, git, and `postgresql-client` (the `psql` command-line tool — the database itself is RDS, managed by AWS, not on this box).
2. Create the system user `ltride` — the unprivileged account from Step 3.
3. Clone the repo and build the `.venv` (same idea as your local venv, but on the server).
4. Write a `.env` template (the real secrets come from Secrets Manager when this runs via the real CloudFormation flow).
5. Install the two files you just wrote: File 2 (`ltride.service`) into systemd, File 1 (`nginx-ltride.conf`) into nginx — symlinking it into `sites-enabled` and removing nginx's default welcome page.
6. Run the SQL migrations against RDS.
7. Start `ltride` and reload nginx.

At the top of the script, **set `REPO_URL`** to your repo's real clone URL — without it, a fresh box can't fetch your code on first boot (the same gotcha as `RepoUrl` in D1's `03-compute.yaml`).

---

## 🧪 Prove it works — testing guide

```bash
cd deploy/server
bash -n provision.sh                 # shell-syntax check (no execution)
# if you have nginx locally (brew install nginx), sanity-test the config too:
nginx -t -c "$PWD/nginx-ltride.conf" 2>&1 | head    # may warn about paths off-server; syntax is what matters
```

**What you should see:**
1. `bash -n provision.sh` prints **nothing** — that means it's valid; any output is a syntax error to fix.
2. `nginx -t` reports on the config's *syntax*. It may complain about paths that don't exist on your laptop (like `/var/www/ltride`) — that's expected and fine; you're checking the file parses as valid nginx config, not that it fully runs here.

The **real** proof only happens once the server exists: after lessons D2/D3, SSH in and run `sudo nginx -t` (→ `syntax is ok` / `test is successful`) and `systemctl status ltride` (→ `active (running)`). You'll do that verification in the next lessons.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add deploy/server/
git commit -m "D1b: nginx + systemd + provisioning config for the server"
git push -u origin cr/d1b-server-config
```

Then open a Pull Request on GitHub with **base = `cr/d1-cfn-templates`** (this CR stacks on D1, not `main`). Paste your "Prove it works" output as the testing evidence. The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`nginx -t` fails with "unknown directive" or a path error** — check for a typo in a directive name, or a missing semicolon at the end of a line; nginx config is picky about both. Path warnings about `/var/www/ltride` not existing locally are expected off-server.
- **`bash -n provision.sh` prints a syntax error** — usually a mismatched quote or an unclosed heredoc (`<<'ENV' … ENV`). Check that every opening quote/heredoc has a matching close.
- **Forgot to set `REPO_URL`** — a real EC2 instance running this script would fail to clone your code on first boot. Double-check it points at your actual repo before D2.
- **`systemctl status ltride` (later, on a real server) shows repeated restarts** — almost always a missing/wrong `.env` value; check with `journalctl -u ltride -n 50`.
- **502 Bad Gateway in the browser (later, once deployed)** — gunicorn crashed or never started; nginx has nothing to proxy to. Check `journalctl -u ltride`.

---

## 📝 Recap — what you built and learned

- You wrote the **nginx config** that serves your React build and reverse-proxies `/api/` to gunicorn — one hardened front door for the whole app.
- You learned the **SPA fallback** (`try_files`) that makes client-side routing survive a page refresh.
- You wrote the **systemd unit** that keeps gunicorn running through crashes and reboots, as an unprivileged user.
- You outlined the **provisioning script** that installs and wires all of this together on a fresh box — the same logic CloudFormation's UserData will run automatically in lesson D2.

---

## 📚 References

- [nginx documentation](https://nginx.org/en/docs/) and [nginx: reverse proxy guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/).
- [nginx `try_files` directive](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files) — the SPA fallback.
- [gunicorn documentation](https://docs.gunicorn.org/en/stable/) — the production WSGI server.
- [PEP 3333 — WSGI](https://peps.python.org/pep-3333/) — the interface between gunicorn and Flask.
- [systemd.service(5) man page](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) — unit file options.
- [Git Branching — Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).
- Source of truth for this lesson: [deployment guide → CR D1b](../deployment-guide.md#cr-d1b--server-configuration-files-nginx-gunicornsystemd-provisioning).

---

## ➡️ Next lesson

**[Lesson D2 — Stand up the infrastructure](D2-stand-up-infrastructure.md).** You'll actually run `./deploy.sh up` and watch CloudFormation create the network, database, and server in AWS for real. → [source CR](../deployment-guide.md#cr-d2--stand-up-the-infrastructure).
