"""App development configuration."""

import pathlib

# Root of this application, useful if it doesn't occupy an entire domain
APPLICATION_ROOT = '/'

# Secret key for encrypting cookies
SECRET_KEY = b'Kv\x01l\xee)\x03@Q\xddn\t\xe0\x8c\x8ajP\xc0\xbfy\xdeu\x86J'
SESSION_COOKIE_NAME = 'login'

# File Upload to var/uploads/
APP_ROOT = pathlib.Path(__file__).resolve().parent.parent
UPLOAD_FOLDER = APP_ROOT/'var'/'uploads'
ALLOWED_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif'])
MAX_CONTENT_LENGTH = 16 * 1024 * 1024

# Database file is var/App.sqlite3
DATABASE_FILENAME = APP_ROOT/'var'/'App.sqlite3'
