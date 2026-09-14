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
