"""app development configuration."""

import pathlib

# Root of this application, useful if it doesn't occupy an entire domain
APPLICATION_ROOT = '/'

# Secret key for encrypting cookies
SECRET_KEY = b'TODO ADD YOUR SECRETKEY: $ python3 -c "import os; print(os.urandom(24))" '
SESSION_COOKIE_NAME = 'login'

APP_ROOT = pathlib.Path(__file__).resolve().parent.parent

# Database file is var/app.sqlite3
DATABASE_FILENAME = APP_ROOT/'var'/'app.sqlite3'