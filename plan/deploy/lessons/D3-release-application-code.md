# Lesson D3 — Release the application code

> **Track:** Deploy · **Lesson 5 of 6**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle (no new files to write — you're running a script and reading what it does)
> **🧩 Prerequisites:** you've done [Lesson D2 — Stand up the infrastructure](D2-stand-up-infrastructure.md) and your AWS infrastructure is live (`./deploy.sh outputs` shows a public IP); your backend code is committed and pushed (ideally through B7).
> **🌿 CR branch:** `cr/d3-release` (off `cr/d2-provision`) · **📄 Source CR:** [CR D3](../deployment-guide.md#cr-d3--release-the-application-code) · **🗺 Big picture:** [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation)

---

## 🎯 Goal — what you'll have at the end

A **live application**, not just live infrastructure. D2 gave you an empty server; this lesson puts your actual code on it.

**✅ Done when (your deliverable checklist):**
- [ ] `curl http://<ElasticIp>/api/health` returns `{"data":{"status":"ok"}}` from the real server (not your laptop).
- [ ] Opening `http://<ElasticIp>` in a browser loads the React app, served by nginx.
- [ ] You can log in as a seeded student against the real database on RDS.
- [ ] Your work is committed on branch `cr/d3-release` and pushed, PR base = `cr/d2-provision`.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

D1–D2 were about **infrastructure**: a network, a database, a bare server. That's the empty apartment — plumbing works, lights turn on, but nobody lives there yet. This lesson **moves your code in**.

Notice the split: **infrastructure changes go through CloudFormation** (`deploy.sh`), but **application changes go through a completely different script** (`release.sh`). That's not an accident — they run on different clocks. You'll re-provision the server maybe once. You'll release new code dozens of times as you build the rest of the CRs. Keeping "change the servers" and "change the code on the servers" as two separate scripts means shipping a bug fix never risks accidentally tearing down your database.

The other thing worth noticing: **database migrations run on the server, against the real RDS database** — not on your laptop. Your local `.env` (from backend lesson B0) points at a database on your machine; the server's `.env` points at RDS. Every schema change you write has to be replayed there, in order, which is exactly what `release.sh backend` does for you.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **SSH** | The secure remote-login protocol `release.sh` uses to run commands on your server. | [OpenSSH manual — ssh(1)](https://man.openbsd.org/ssh.1) |
| **`git pull --ff-only`** | Fetches the latest commits and applies them, but refuses if the server's copy has diverged. | [git-pull docs](https://git-scm.com/docs/git-pull) |
| **Running DB migrations** | Replaying your `sql/migrations/*.sql` files against the live database, in order, via `psql`. | [psql — PostgreSQL interactive terminal](https://www.postgresql.org/docs/current/app-psql.html) |
| **Restarting a systemd service** | Telling the OS to stop and start `ltride.service` (gunicorn) so it picks up new code. | [systemctl(1) manual](https://www.freedesktop.org/software/systemd/man/systemctl.html) |
| **gunicorn** | The production WSGI server that actually runs your Flask app on the box (installed in backend lesson B0). | [Gunicorn documentation](https://docs.gunicorn.org/en/stable/) |
| **`rsync`** | Copies only the changed files between two locations — used here to ship the built frontend to the server. | [rsync(1) manual](https://download.samba.org/pub/rsync/rsync.1) |
| **Building the frontend with a prod `VITE_API_URL`** | Baking the real server's address into the React build at build time, not at runtime. | [Vite — Env Variables and Modes](https://vite.dev/guide/env-and-mode.html) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → release the backend (20) → release the frontend (20) → release everything at once + verify (15).

You need: D2's infrastructure live, your backend committed and pushed to `main` (or at least reachable from the branch you're releasing), and — if you're testing the frontend — the UI repo checked out as a sibling directory (`release.sh` expects `../lt-parking-site-project` by default; override with `UI_DIR` if yours lives elsewhere).

**Make your branch off D2's:**
```bash
git checkout cr/d2-provision
git pull
git checkout -b cr/d3-release   # this lesson's branch
```

**What this does & why:** D3 depends on D2's infrastructure existing, so its branch starts from D2's, keeping the stack in the right order for review. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Release the backend (~20 min)

```bash
cd ~/workspace/LTR-Backend/deploy
./release.sh backend
```

**What this does & why, one piece at a time** (straight from `release.sh`):
- **SSHes into the server** as the `ltride` system user (the account D1b's `provision.sh` created — never root). → [SSH manual](https://man.openbsd.org/ssh.1).
- **`git pull --ff-only`** in `/home/ltride/app` — pulls your latest committed code. `--ff-only` means "only if this is a straight fast-forward"; if the server's checkout has diverged, it fails loudly instead of silently merging something unexpected. → [git-pull docs](https://git-scm.com/docs/git-pull).
- **`pip install -r requirements.txt`** inside the server's `.venv` — installs any new library you added since the last release (the same file from backend lesson B0).
- **Runs every file in `sql/migrations/*.sql`** through `psql "$DATABASE_URL"` — this is how schema changes reach the real RDS database. Files run in filename order, so migrations are numbered. → [psql docs](https://www.postgresql.org/docs/current/app-psql.html).
- **`sudo systemctl restart ltride`** — restarts the gunicorn service (from backend lesson B0 / deploy lesson D1b) so it loads the new code and picks up any `.env` changes. → [systemctl manual](https://www.freedesktop.org/software/systemd/man/systemctl.html).
- **Curls `http://127.0.0.1:8000/api/health`** *on the server itself* (before nginx is even involved) and fails the whole script if it doesn't get a healthy response — so you find out immediately if the restart didn't take.

### Step 2 — Release the frontend (~20 min)

```bash
./release.sh frontend
```

**What this does & why:**
- **`npm run build`** inside the UI repo, with `VITE_API_URL` set to `https://<your-domain>` (or `https://<ElasticIp>` if you don't have a domain yet — that comes in lesson D4). Vite bakes this value into the compiled JavaScript at build time — there's no `.env` to read on a static site once it's deployed, so the API address has to be "burned in" before upload. → [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode.html).
- **`rsync`s the built `dist/` folder** to the server, then moves it into nginx's web root (`/var/www/ltride`, from deploy lesson D1b) with `--delete`, so old files from a previous build don't linger. → [rsync manual](https://download.samba.org/pub/rsync/rsync.1).
- **`sudo nginx -t && sudo systemctl reload nginx`** — tests the config, then reloads nginx so it starts serving the new files. `reload` (not `restart`) means it never drops an in-flight connection.

### Step 3 — Do both at once with `./release.sh all` (~10 min)

```bash
./release.sh all
```

**What this does & why:** runs Step 1 then Step 2, in that order — backend first, so that by the time the new frontend is live, the API it's about to call already understands any new request shapes. This is the command you'll actually run day-to-day, once you trust both halves individually. Every option (`backend`, `frontend`, `all`) is the same script — `all` is just "do the other two in sequence."

---

## 🧪 Prove it works — testing guide

```bash
./release.sh all
curl http://<ElasticIp>/api/health
```

**What you should see:**
1. `release.sh` prints a green `✓` for both the backend health check and the frontend upload, ending in `release complete`.
2. The `curl` returns `{"data":{"status":"ok"}}` — this is the real server answering, not your laptop.

Now open `http://<ElasticIp>` (use `./deploy.sh outputs` if you forgot the IP) in a browser and **log in as a seeded student**. The page should load, and login should succeed against the real RDS database — proof that the frontend, the backend, and the database are all correctly wired together on AWS.

---

## 🚀 Save your work (commit & open the CR)

This CR is mostly *running* `release.sh`, not writing new files — much like D2. If you didn't need to touch any file, there's nothing to commit, but you should still push the branch so the CR shows up in the tracker with your testing evidence. If you *did* tweak something (a `release.sh` fix, a `params/prod.json` value, a migration file), commit it:

```bash
git add -A
git commit -m "D3: release application code to the server; verify health check + login"
git push -u origin cr/d3-release
```

Open a Pull Request on GitHub with **base = `cr/d2-provision`**. Paste your `curl` output and a note that login worked as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **Migration didn't run / `psql` errors out** — check that `sql/migrations/*.sql` has valid SQL and that a file that already ran isn't being re-applied in a way that conflicts (e.g., `CREATE TABLE` without `IF NOT EXISTS`). SSH in and check the server's `.env` has the right `DATABASE_URL`, then re-run `./release.sh backend`.
- **Missing server `.env` var → gunicorn won't start** — `sudo journalctl -u ltride -n 50` will show something like `KeyError: 'SECRET_KEY'`, exactly the "fail loud" behavior from backend lesson B0, just on the server. The server's `.env` lives at `/home/ltride/app/.env`, written by D1b's provisioning — confirm it exists and has every key `config.py` requires.
- **`502 Bad Gateway` in the browser** — the backend crashed after restart. Check `sudo journalctl -u ltride -n 50` on the server; it's almost always a missing env var or a database connection error.
- **CORS errors in the browser console** — `CORS_ORIGINS` in the server's `.env` doesn't include the origin you're testing from. Edit it, then `sudo systemctl restart ltride`.
- **Website loads but every API call fails** — the frontend was built with the wrong `VITE_API_URL`. Re-run `./release.sh frontend` and confirm the URL it prints matches where you're actually browsing.

---

## 📝 Recap — what you built and learned

- You shipped your **actual application code** onto the infrastructure D2 stood up — the difference between "a server exists" and "the app is live."
- You saw why **infrastructure changes (CloudFormation) and application changes (`release.sh`) are deliberately separate scripts** running on different clocks.
- You learned that **database migrations run on the server against RDS**, in filename order, as part of every backend release.
- You practiced the same **stacked-CR git routine** — branch → run → test → commit → PR — you've used in every lesson so far.

---

## 📚 References

- [Gunicorn documentation](https://docs.gunicorn.org/en/stable/) — the production WSGI server `ltride.service` runs.
- [systemctl(1) manual](https://www.freedesktop.org/software/systemd/man/systemctl.html) — restarting/reloading services.
- [git-pull documentation](https://git-scm.com/docs/git-pull) — `--ff-only` and why it matters on a server.
- [psql — PostgreSQL interactive terminal](https://www.postgresql.org/docs/current/app-psql.html) — how `sql/migrations/*.sql` gets applied.
- [rsync(1) manual](https://download.samba.org/pub/rsync/rsync.1) — shipping the built frontend to the server.
- [OpenSSH manual — ssh(1)](https://man.openbsd.org/ssh.1) — how `release.sh` reaches the server.
- [Vite — Env Variables and Modes](https://vite.dev/guide/env-and-mode.html) — baking `VITE_API_URL` into the production build.
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [deployment guide → CR D3](../deployment-guide.md#cr-d3--release-the-application-code).

---

## ➡️ Next lesson

**[Lesson D4 — Buy a domain, wire Route 53, turn on HTTPS](D4-domain-route53-https.md).** You'll replace the bare IP with a real domain name and add a padlock. → [source CR](../deployment-guide.md#cr-d4--buy-a-domain-wire-it-to-route-53-and-turn-on-https).
