# Glossary — the words these lessons use

New words show up fast when you build a server. This page explains each one in **one or two plain sentences**, the way you'd explain it to a friend. Every lesson links the *first* time it uses a word here, so you can click, read, and jump back.

> **How to read this:** you do **not** need to memorize any of this before you start. Skim it once, then come back whenever a lesson uses a word you don't recognize. The official docs are linked at the end of each entry if you want the full story.

---

## The tools that run your server

### Python
The programming language the whole backend is written in. It runs on your computer (and later on the server) and executes the code you write in each lesson. → [Python docs](https://docs.python.org/3/).

### pip
The tool that downloads Python code other people wrote (called **packages**) into your project. `pip install flask` fetches one; `pip install -r requirements.txt` fetches every package a project lists. → [pip docs](https://pip.pypa.io/en/stable/).

### Virtual environment
Often shortened to **venv**. A private box of Python packages that belongs to *this* project only, so its versions can't clash with another project's on the same computer. You "activate" it before you work. → [Python: venv](https://docs.python.org/3/library/venv.html).

### requirements.txt
A plain-text list of every package your project needs (with versions), so anyone who clones it can install the exact same set with one command. → [pip: requirements files](https://pip.pypa.io/en/stable/reference/requirements-file-format/).

### Flask
The Python **web framework** the whole backend runs on — it turns your functions into a real server that listens for web requests and sends answers back. → [Flask docs](https://flask.palletsprojects.com/).

### WSGI
The standard "socket" between a Python web app (like your Flask app) and the program that actually serves it to the internet. You rarely touch it directly; it's why the same app runs under `flask run` locally and `gunicorn` in production. → [WSGI explainer](https://wsgi.readthedocs.io/en/latest/what.html).

### gunicorn
The production-grade program that runs your Flask app on the real server (instead of the toy `flask run` dev server), handling many requests at once. → [Gunicorn docs](https://docs.gunicorn.org/en/stable/).

### curl
The terminal tool you use to send an HTTP request and see the raw response, without a browser — how you test every endpoint you build. → [curl man page](https://curl.se/docs/manpage.html).

### Environment variable
A setting read from *outside* the code (from a `.env` file) so it can differ per computer — like the database address or secret key being one value on your laptop and another once deployed. Keeps secrets out of the code. → [12-Factor: Config](https://12factor.net/config).

### SECRET_KEY
A random string Flask uses to sign things (like the tokens and cookies it hands out) so they can't be faked. It lives in `.env`, never in the code. → [Flask: SECRET_KEY](https://flask.palletsprojects.com/en/stable/config/#SECRET_KEY).

---

## How the server answers requests (Flask + HTTP)

### API
The set of web addresses your server offers for other programs to call — like `POST /api/auth/student` to log in. Short for *Application Programming Interface*. → [MDN: Web APIs](https://developer.mozilla.org/en-US/docs/Web/API).

### Endpoint
One specific address in the API, e.g. `GET /api/health`. Each endpoint does one job. → [MDN: Web APIs](https://developer.mozilla.org/en-US/docs/Web/API).

### Route
The rule that ties a URL (and method) to the Python function that answers it. "The `/api/health` route" means "the function that runs when someone asks for `/api/health`." → [Flask: Routing](https://flask.palletsprojects.com/en/stable/quickstart/#routing).

### Decorator
A line starting with `@` written directly above a function that adds behavior to it. `@bp.get("/api/health")` decorates a function so Flask calls it for that URL. → [Python: decorators](https://docs.python.org/3/glossary.html#term-decorator).

### Blueprint
A named, self-contained group of related routes (all the `auth` routes, all the `lots` routes, …) kept in its own file and registered with the app. Keeps you from cramming every route into one giant file. → [Flask: Blueprints](https://flask.palletsprojects.com/en/stable/blueprints/).

### App factory
The one function — `create_app()` — that builds and returns a fully-wired Flask app (config, CORS, blueprints, error handlers). Building the app inside a function (instead of at import time) lets tests build a separate, identical app. → [Flask: Application factories](https://flask.palletsprojects.com/en/stable/patterns/appfactories/).

### HTTP methods
The "verbs" a request can use: **GET** reads data, **POST** creates something, **PATCH** changes part of something, **PUT** replaces it whole, **DELETE** removes it. → [MDN: HTTP methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods).

### Status code
The 3-digit number in every response that says how it went at a glance: **200** OK, **201** created, **400** bad request, **401** unauthorized, **403** forbidden, **404** not found, **500** server error. → [MDN: HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status).

### Request
The message a client (a browser, `curl`, the React app) sends to your server: a method, a URL, optional headers, and an optional JSON body. → [MDN: HTTP messages](https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages).

### Response
The message your server sends back: a status code, headers, and usually a JSON body. → [MDN: HTTP messages](https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages).

### JSON
A plain-text format for sending structured data — objects in `{ }`, lists in `[ ]`. It's how the frontend and backend exchange data. → [MDN: JSON](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON).

### jsonify
Flask's helper that turns a Python dictionary into a proper JSON response with the right `Content-Type` header set. → [Flask: jsonify](https://flask.palletsprojects.com/en/stable/api/#flask.json.jsonify).

### Envelope
The server wraps every good answer as `{ "data": … }` and every error as `{ "error": { "code", "message" } }`, so the frontend always gets the same predictable shape. → [MDN: JSON](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON).

### Query parameter
The `?key=value` part on the end of a URL that passes options to an endpoint, e.g. `/api/students?q=smith` searches for "smith". → [MDN: search params](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams).

### Error handler
A function you register (with `@app.errorhandler(404)`) that decides exactly what JSON an error sends back, instead of Flask's default HTML error page. → [Flask: Handling application errors](https://flask.palletsprojects.com/en/stable/errorhandling/).

### CORS
A browser safety rule that blocks a page on one address from calling a server on a different address unless that server opts the address in. `flask-cors` is how the server says "the React app is allowed." → [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

---

## Storing data (the database + SQL)

> This project talks to the database with **hand-written SQL** run through a database **cursor** — there is **no ORM** (no SQLAlchemy, no model classes). So in every data lesson you'll read real SQL, not Python objects standing in for tables.

### Database
The program that stores your app's data on disk in an organized, queryable way, so it survives restarts. The lessons build the tables in **PostgreSQL**; a **SQLite** file is a handy zero-setup option for quick local dev. → [MDN: databases](https://developer.mozilla.org/en-US/docs/Glossary/Database).

### SQLite
A tiny database that lives in a single file on your computer — zero setup, handy for quick local dev. → [SQLite docs](https://www.sqlite.org/index.html).

### PostgreSQL
A full, production-grade database server; the lessons build the real tables in it (`CREATE TABLE`, foreign keys, constraints). You talk to it with the `psql` client and hand-written SQL. → [PostgreSQL docs](https://www.postgresql.org/docs/).

### psql
The terminal program you use to talk to a PostgreSQL database: `psql mydb -f file.sql` runs a whole file, `psql mydb -c "SQL..."` runs one command, and `\q` quits an interactive session. → [psql reference](https://www.postgresql.org/docs/current/app-psql.html).

### SQL
The language you write to talk to the database — `CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`. This project writes SQL **by hand** (no ORM), which is why you read real SQL in every data lesson. → [PostgreSQL: SQL](https://www.postgresql.org/docs/current/sql.html).

### Migration
A numbered `.sql` file that builds or changes the database's tables. Running it sets the database up; this project keeps them in `backend/webapp/sql/migrations/`. → [Schema migration](https://en.wikipedia.org/wiki/Schema_migration).

### Schema
The overall shape of the database: which tables exist, what columns each has, and how they relate. → [MDN: schema](https://developer.mozilla.org/en-US/docs/Glossary/Schema).

### Seed data
A little starter data you load into fresh tables (a couple of lots, a test student) so the endpoints you build have something real to read. → [Seed data explainer](https://en.wikipedia.org/wiki/Database_seeding).

### get_db (database connection)
The helper every route calls to reach the database: it opens one connection per request (kept on Flask's `g`) and hands you a **cursor** to run SQL through. → [Flask: Application context (`g`)](https://flask.palletsprojects.com/en/stable/appcontext/).

### Cursor
The object you run SQL through: `cur = get_db().cursor(); cur.execute("SELECT ...", params); cur.fetchall()`. It carries your query to the database and the rows back. → [Python DB-API: Cursor objects](https://peps.python.org/pep-0249/#cursor-objects).

### Primary key
The column (usually `id`) that uniquely identifies each row in a table, so no two rows are ever confused. → [PostgreSQL: Primary Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS).

### Foreign key
A column that points at another table's primary key — e.g. a space's `lot_id` points at the lot it belongs to — which is how tables link together (and the database enforces it). → [PostgreSQL: Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK).

### Transaction
A group of database changes that all succeed together or all get undone together — so the data is never left half-changed. `commit()` saves the group; `rollback()` cancels it. → [PostgreSQL: transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html).

### Serialization
Turning a database row into plain JSON-friendly values (a dict of strings and numbers) so it can be sent in a response. The `serialize.py` helpers in this project do that. → [MDN: serialization](https://developer.mozilla.org/en-US/docs/Glossary/Serialization).

---

## Logging in & permissions

### Authentication
Proving *who* you are — logging in with a password and getting a token back. (Contrast with authorization: what you're *allowed* to do.) → [MDN: Authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

### JWT
Also just called a **token**. A signed slip of text the server hands you at login that proves "yes, this is user #12, an admin." The client re-sends it on every later request so you don't retype your password. → [jwt.io: Introduction](https://jwt.io/introduction).

### Password hash
A password is never stored as-is. It's run through a one-way scrambler (**Werkzeug's scrypt** here) into a "hash"; at login the server hashes what you typed and compares — so even a stolen database never reveals real passwords. → [OWASP: Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Role
A label on a user — `student` or `admin` — that decides which endpoints they may call. The `@require_role("admin")` guard rejects anyone without it. → [MDN: Authorization](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authorization).

---

## A few more you'll meet

### CSV
A plain-text spreadsheet format — one row per line, columns separated by commas. Used to import/export the student roster in B13. → [MDN: CSV](https://developer.mozilla.org/en-US/docs/Glossary/CSV).

### Upsert
"Update-or-insert": for each incoming row, update the matching record if it already exists, otherwise create it. The CSV roster import in B13 works this way. → [Upsert explainer](https://wiki.postgresql.org/wiki/UPSERT).

### Idempotent
An operation you can safely repeat with the same result — running it twice does no extra harm (e.g. a `PUT` that replaces a layout). → [MDN: Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent).

---

*Missing a word? It probably means it hasn't come up in a lesson yet. Add it here the first time a lesson uses it, keeping the one-or-two-sentence, plain-language style above.*
