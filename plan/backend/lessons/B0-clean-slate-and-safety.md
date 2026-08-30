# Lesson B0 — Clean slate & safety

> **Track:** Backend · **Lesson 1 of 10** (B0 → B9)
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle (no features yet — this is the setup that keeps you safe)
> **🧩 Prerequisites:** you've done backend [Part 0 setup](../backend-development-guide.md#part-0--one-time-setup) (VS Code, Python 3.11+, Git, PostgreSQL installed; a `.venv` you can activate).
> **🌿 CR branch:** `cr/b0-hygiene` (off `main`) · **📄 Source CR:** [backend guide → CR B0](../backend-development-guide.md#cr-b0--clean-slate--safety-do-this-first) · **🗺 Big picture:** [plan.md §8](../../plan.md#8-implementation-strategy-stacked-crs)

---

## 🎯 Goal — what you'll have at the end

A project that is **safe to share on GitHub** and **reads its secrets from outside the code**. Concretely, by the end of this hour you will have:

- A `.gitignore` that stops secrets and junk files from ever being committed.
- A `webapp/requirements.txt` listing every Python library the next 7 lessons need.
- A `config.py` that reads its secret key and database address from the **environment**, not from a string typed into the code.
- A local `.env` (your private secrets, never committed) and a committed `.env.example` (the blank template for the next person).

**✅ Done when (your deliverable checklist):**
- [ ] `git status` does **not** list `.venv/`, `__pycache__/`, `.env`, or any `*.pem` file.
- [ ] `python -c "import webapp.App.config as c; print('SECRET loaded:', bool(c.SECRET_KEY))"` prints `SECRET loaded: True`.
- [ ] Temporarily renaming `.env` makes that same command **crash loudly** with `KeyError: 'SECRET_KEY'`.
- [ ] Your work is committed on branch `cr/b0-hygiene` and pushed, PR base = `main`.

---

## 🤔 Why this lesson matters (read this first — it's the "why")

Imagine you push your code to GitHub and, buried in a file, there's a line like `SECRET_KEY = "hunter2"`. That key is what signs the login tokens for the whole app. Anyone who reads your public repo now owns your app's front door. This has happened to real companies and cost real money — bots scan GitHub for leaked secrets within *seconds* of a push.

So before we build **any** feature, we do two boring-but-critical things that every professional project does:

1. **Tell Git what to ignore** so private files (secrets, your virtual environment, the AWS key) can never be committed by accident.
2. **Separate secrets from code.** The code says "give me the value named `SECRET_KEY`"; the actual value lives in a file (`.env`) that never leaves your laptop, or in server settings in production. This idea is called **"config in the environment"** and it's principle III of the widely-used [Twelve-Factor App](https://12factor.net/config) methodology.

Getting this right now means every later lesson (login, database, deploy) is safe by default. This is the foundation the other 21 lessons stand on.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **`.gitignore`** | A list of file patterns Git should pretend don't exist. | [GitHub docs: Ignoring files](https://docs.github.com/en/get-started/git-basics/ignoring-files) |
| **Environment variable** | A named setting read from *outside* the program at run time. | [Wikipedia: Environment variable](https://en.wikipedia.org/wiki/Environment_variable) · [12-Factor: Config](https://12factor.net/config) |
| **`.env` file + python-dotenv** | A local file of `NAME=value` lines a library loads into the environment. | [python-dotenv docs](https://saurabh-kumar.com/python-dotenv/) |
| **`requirements.txt`** | The list of Python libraries `pip` should install for this project. | [pip: Requirements files](https://pip.pypa.io/en/stable/reference/requirements-file-format/) |
| **Secret key** | The random string Flask uses to sign/verify security tokens. | [Flask: SECRET_KEY](https://flask.palletsprojects.com/en/stable/config/#SECRET_KEY) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → `.gitignore` (10) → `requirements.txt` (10) → `config.py` (15) → `.env` + `.env.example` (10) → test & commit (10).

**Open your terminal, activate the virtual environment, and make your branch.** In the stacked-CR workflow each lesson lives on its own branch that starts from the one before it; B0 starts from `main`.

```bash
source .venv/bin/activate      # your prompt should now start with (.venv)
git checkout main
git pull                       # make sure you start from the latest main
git checkout -b cr/b0-hygiene  # create + switch to this lesson's branch
```

**What this does & why:** `checkout -b` creates a new branch and moves you onto it, so your changes are isolated and reviewable as one small unit. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Stop committing secrets and junk (~10 min)

Create or open `.gitignore` at the **repo root** and make sure it contains exactly these lines (add any that are missing — order doesn't matter):

```gitignore
# Python
.venv/
env/
__pycache__/
*.pyc

# local database files (if you ever use SQLite)
*.sqlite3

# secrets & local settings — NEVER commit these
.env

# the AWS key file (handled separately — do not touch the key itself)
*.pem

# build output / dependencies
node_modules/
dist/

# dev server runtime files (PID + logs the webapp/bin/server script writes; see B1)
webapp/var/
```

**Explanation, line group by line group:**
- `.venv/`, `env/`, `__pycache__/`, `*.pyc` — Python's virtual environment and compiled cache files. They're big, machine-specific, and get regenerated automatically, so they should never be in Git.
- `.env` — **your secrets.** This is the single most important line here.
- `*.pem` — the AWS private key. Leaking this would let someone log into your server. (Don't touch the `aws-tutorial.pem` file itself — it's handled separately.)
- `node_modules/`, `dist/` — the frontend's installed libraries and build output; also regenerated, never committed.
- `webapp/var/` — where the dev-server convenience script (`webapp/bin/server`, introduced in [Lesson B1](B1-health-check.md)) writes its process id and log files. Runtime junk, regenerated on every start — never committed.

> **How `.gitignore` matches:** a trailing `/` means "a folder"; `*` is a wildcard. So `*.pem` means "any file ending in `.pem`, anywhere." → Reference: [gitignore pattern format](https://git-scm.com/docs/gitignore#_pattern_format).

### Step 2 — List the libraries this project needs (~10 min)

Open `webapp/requirements.txt`. The course template left a long tail of pinned
packages in there (`Flask==2.2.2`, `Werkzeug==2.2.2`, `pylint==2.16.2`, and
~30 more, down to `wrapt==1.14.1`) — those exact old versions don't install
cleanly on a modern Python, and none of them are things this backend actually
uses. **Delete everything in the file and replace it with exactly these seven
lines:**

```text
Flask>=2.2
flask-cors>=4.0
psycopg[binary]>=3.1
PyJWT>=2.8
python-dotenv>=1.0
Werkzeug>=2.2
gunicorn>=21.2
```

**What each library is for (you'll use them in later lessons):**
- **[Flask](https://flask.palletsprojects.com/)** `>=2.2` — the web framework; the whole backend is built on it.
- **[flask-cors](https://flask-cors.readthedocs.io/)** `>=4.0` — lets your React site (a different address) call this API safely (lesson B1/B3).
- **[psycopg](https://www.psycopg.org/psycopg3/docs/)** `[binary]>=3.1` — talks to the PostgreSQL database (lesson B3). `[binary]` grabs a prebuilt version so you don't need a compiler.
- **[PyJWT](https://pyjwt.readthedocs.io/)** `>=2.8` — makes and checks login tokens (lesson B3).
- **[python-dotenv](https://saurabh-kumar.com/python-dotenv/)** `>=1.0` — loads your `.env` file (this lesson, step 3).
- **[Werkzeug](https://werkzeug.palletsprojects.com/)** `>=2.2` — Flask's engine; also hashes passwords (lesson B3).
- **[gunicorn](https://gunicorn.org/)** `>=21.2` — the production server that runs Flask on AWS (deploy lesson D3).

> **If you're comparing against the reference repo:** the shipped `webapp/requirements.txt` in the reference implementation still carries the old course-template pins — the clean-up in this step was never committed there. It's harmless (the app only imports the seven libraries above), but that's why the reference file looks longer than the seven lines you just wrote.

The `>=` means "this version **or newer**." → Reference: [pip version specifiers](https://pip.pypa.io/en/stable/reference/requirement-specifiers/). Now install them (venv active):

```bash
pip install -r webapp/requirements.txt
```

### Step 3 — Move the secret key out of the code (~15 min)

Open `webapp/App/config.py`. Find the hard-coded line that looks like `SECRET_KEY = "some-literal-string"` and replace the whole file with this environment-driven version:

```python
# webapp/App/config.py
"""All settings come from environment variables (loaded from .env locally)."""
import os

# Loads variables from a local .env file if present. On the real server the
# variables are set by systemd, so this is a no-op there.
from dotenv import load_dotenv
load_dotenv()

# Required — the app refuses to start if these are missing.
SECRET_KEY = os.environ["SECRET_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]

# Optional — sensible defaults for local development.
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", "12"))
```

**Explanation, line by line:**
- `import os` — the standard library that lets Python read environment variables. → [os.environ docs](https://docs.python.org/3/library/os.html#os.environ).
- `from dotenv import load_dotenv` / `load_dotenv()` — reads your local `.env` file and copies its `NAME=value` pairs into the environment. On the AWS server there's no `.env`; systemd sets the variables instead, so this line simply does nothing there. → [python-dotenv usage](https://saurabh-kumar.com/python-dotenv/#getting-started).
- `os.environ["SECRET_KEY"]` — square brackets mean **"this is required."** If it's missing, Python raises `KeyError` and the app refuses to start.
- `os.environ.get("CORS_ORIGINS", "…")` — `.get()` with a default means **"optional."** If unset, it uses the fallback value.
- `int(os.environ.get("JWT_EXP_HOURS", "12"))` — environment values are always text, so we convert to a number with `int(...)`.

> **Why `[...]` for secrets and `.get(...)` for the rest?** Square brackets make the app **crash immediately with a clear error** if a required secret is missing — far better than starting up "half-configured" and failing mysteriously later. This is the "fail loud, fail early" principle. → Reference: [12-Factor: Config](https://12factor.net/config).

> **Looking ahead — the real admin login.** Once the database exists (lesson B2) you'll use `webapp/bin/add-admin` to create the actual admin user (it hashes a password with Werkzeug's scrypt and upserts the `users` row). Nothing to run yet — just know it's there so you don't hand-write SQL for it later.

### Step 4 — Create your local `.env` (~5 min)

Create a `.env` file at the **repo root**. It's git-ignored (from Step 1), so it stays on your machine only:

```dotenv
SECRET_KEY=dev-only-change-me-to-anything-long-and-random
DATABASE_URL=postgresql://localhost/ltride_dev
CORS_ORIGINS=http://localhost:5173
JWT_EXP_HOURS=12
```

**Explanation:** each line is `NAME=value` with no quotes and no spaces around `=` — that's the `.env` format `python-dotenv` expects. `SECRET_KEY` can be any long random string for local dev. `DATABASE_URL` points at a local PostgreSQL database named `ltride_dev` you'll create in lesson B2. → Reference: [.env file rules](https://saurabh-kumar.com/python-dotenv/#file-format).

### Step 5 — Create the committed template `.env.example` (~5 min)

Create `.env.example` at the repo root — the **same keys but no real secrets.** This one *is* committed, so the next person knows exactly what to fill in:

```dotenv
SECRET_KEY=
DATABASE_URL=postgresql://localhost/ltride_dev
CORS_ORIGINS=http://localhost:5173
JWT_EXP_HOURS=12
```

**Why keep an example?** A blank template documents "here are the settings this app needs" without leaking any actual secret. It's the standard way projects onboard new developers. → Reference: [12-Factor: Config — storing config](https://12factor.net/config).

> **Note:** the reference implementation repo doesn't actually commit a `.env.example` — it keeps only a local (git-ignored) `.env`. Creating the template is still the recommended practice, so do it here; just don't be surprised if you don't find one in the reference repo.

---

## 🧪 Prove it works — testing guide

```bash
git status                                  # 1) what would be committed?
python -c "import webapp.App.config as c; print('SECRET loaded:', bool(c.SECRET_KEY))"   # 2)
```

**What you should see:**
1. `git status` does **not** list `.venv/`, `__pycache__/`, `.env`, or any `*.pem` file. (If it does, re-check Step 1.)
2. The second command prints `SECRET loaded: True` — proving the secret came from `.env`, not from the code.

**Now prove the "fail loud" safety net works** — temporarily rename `.env` and run the command again:

```bash
mv .env .env.bak
python -c "import webapp.App.config as c; print(c.SECRET_KEY)"   # should CRASH with KeyError
mv .env.bak .env                                                 # put it back!
```

A `KeyError: 'SECRET_KEY'` here is **success** — it's the intended behavior from Step 3. Remember to move `.env` back.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add -A
git commit -m "B0: gitignore junk, move SECRET_KEY/DATABASE_URL to env, add .env.example"
git push -u origin cr/b0-hygiene
```

Then open a Pull Request on GitHub with **base = `main`**. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`git status` still shows `.env`** — you probably committed it earlier. `.gitignore` only ignores *untracked* files. Run `git rm --cached .env` to stop tracking it, then commit.
- **`ModuleNotFoundError: No module named 'dotenv'`** — the install in Step 2 didn't run in the active venv. Confirm `(.venv)` is in your prompt, then re-run `pip install -r webapp/requirements.txt`.
- **`KeyError: 'SECRET_KEY'` when you *didn't* rename `.env`** — your `.env` is in the wrong folder (must be the repo root, the same folder you run `python` from) or has a typo in the key name.
- **`pip install` fails partway through, often on an old pin like `Flask==2.2.2` or `wrapt==1.14.1`** — you edited `requirements.txt` instead of replacing it; the leftover course-template pins from Step 2 don't install on modern Python. Delete them so the file has exactly the seven `>=` lines, then re-run `pip install -r webapp/requirements.txt`.

---

## 📝 Recap — what you built and learned

- You made the repo **safe to publish**: secrets and junk can no longer be committed.
- You learned the **config-in-the-environment** pattern: code names a setting, the value lives outside the code.
- You set up `requirements.txt` so every later lesson can install what it needs in one command.
- You practiced the **stacked-CR git routine** (branch → change → test → commit → PR) you'll repeat in all 21 remaining lessons.

---

## 📚 References

- [The Twelve-Factor App — III. Config](https://12factor.net/config) — why secrets belong in the environment.
- [GitHub Docs — Ignoring files](https://docs.github.com/en/get-started/git-basics/ignoring-files) and [gitignore pattern format](https://git-scm.com/docs/gitignore).
- [python-dotenv documentation](https://saurabh-kumar.com/python-dotenv/) — loading `.env` files.
- [Python `os.environ`](https://docs.python.org/3/library/os.html#os.environ) — reading environment variables.
- [Flask configuration — SECRET_KEY](https://flask.palletsprojects.com/en/stable/config/#SECRET_KEY).
- [pip requirements file format](https://pip.pypa.io/en/stable/reference/requirements-file-format/) and [version specifiers](https://pip.pypa.io/en/stable/reference/requirement-specifiers/).
- [Git Branching — Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).
- Source of truth for this lesson: [backend guide → CR B0](../backend-development-guide.md#cr-b0--clean-slate--safety-do-this-first).

---

## ➡️ Next lesson

**[Lesson B1 — Health check (prove the server runs)](B1-health-check.md).** You'll start the Flask server for the first time and add a `GET /api/health` endpoint that answers "I'm alive." → [source CR](../backend-development-guide.md#cr-b1--health-check-prove-the-server-runs).
