#!/usr/bin/env bash
# =============================================================================
# provision.sh — one-time setup of a fresh Ubuntu EC2 box for LTRide.
#
# WHAT THIS DOES (top to bottom):
#   1. Installs the OS packages we need (python, nginx, git, postgres client).
#   2. Creates the unprivileged "ltride" user that owns and runs the app.
#   3. Clones the backend repo and builds its Python virtualenv.
#   4. Installs the systemd service (gunicorn) and the nginx site config.
#   5. Starts everything.
#
# WHEN TO RUN IT:
#   - Normally you DON'T run this by hand — the CloudFormation compute stack's
#     "UserData" runs an equivalent of this automatically when the EC2 instance
#     first boots (see deploy/cfn/03-compute.yaml / plan §10.5-§10.6).
#   - Use this script directly if you SSH into a box and want to (re)provision
#     it manually, or to understand exactly what UserData is doing.
#
# RUN AS ROOT (UserData runs as root; if running by hand use sudo):
#   sudo bash provision.sh
#
# This script is idempotent-ish: re-running it updates configs and restarts,
# but it won't wipe your database (that lives on RDS, separately).
# =============================================================================
set -euo pipefail

APP_USER="ltride"
APP_HOME="/home/${APP_USER}"
APP_DIR="${APP_HOME}/app"
WEB_ROOT="/var/www/ltride"
REPO_URL="${REPO_URL:-https://github.com/LTRide2/LTR-Backend.git}"   # public clone URL; override with REPO_URL=... if private
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

# --- 1. OS packages ---------------------------------------------------------
log "installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
    python3 python3-venv python3-pip \
    nginx \
    git \
    postgresql-client          # the `psql` client, to run migrations against RDS
# (We install the postgres *client* only — the database itself is RDS, managed
#  by AWS, not running on this box.)

# --- 2. app user ------------------------------------------------------------
if ! id "$APP_USER" >/dev/null 2>&1; then
    log "creating user ${APP_USER}"
    # --system: a service account (no password login); --create-home: give it /home/ltride
    useradd --system --create-home --shell /bin/bash "$APP_USER"
fi

# --- 3. code + virtualenv ---------------------------------------------------
if [[ ! -d "$APP_DIR/.git" ]]; then
    log "cloning repo into ${APP_DIR}"
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
    log "repo already present, pulling latest"
    sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
fi

log "building virtualenv + installing requirements"
sudo -u "$APP_USER" bash -lc "
    cd '$APP_DIR'
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r webapp/requirements.txt
"

# --- 3b. the production .env (secrets) --------------------------------------
# We do NOT create .env here with real secrets in plaintext. In the real
# CloudFormation flow, UserData pulls DATABASE_URL (with the RDS password from
# Secrets Manager) and a generated SECRET_KEY and writes them to this file.
# If provisioning by hand, create it now:
if [[ ! -f "$APP_DIR/.env" ]]; then
    log "WARNING: ${APP_DIR}/.env not found — creating a TEMPLATE you must fill in"
    sudo -u "$APP_USER" tee "$APP_DIR/.env" >/dev/null <<'ENVTEMPLATE'
SECRET_KEY=CHANGE_ME_to_a_long_random_string
DATABASE_URL=postgresql://ltride:DB_PASSWORD@YOUR_RDS_ENDPOINT:5432/ltride
CORS_ORIGINS=https://YOUR_DOMAIN_OR_IP
JWT_EXP_HOURS=12
ENVTEMPLATE
    chmod 600 "$APP_DIR/.env"          # readable only by the ltride user
fi

# --- 4a. systemd service (gunicorn) -----------------------------------------
log "installing systemd unit"
cp "$SCRIPT_DIR/ltride.service" /etc/systemd/system/ltride.service
systemctl daemon-reload
systemctl enable ltride                # start on every boot

# --- 4b. nginx site ---------------------------------------------------------
log "installing nginx site config"
mkdir -p "$WEB_ROOT"
chown -R "$APP_USER":"$APP_USER" "$WEB_ROOT"
cp "$SCRIPT_DIR/nginx-ltride.conf" /etc/nginx/sites-available/ltride
ln -sf /etc/nginx/sites-available/ltride /etc/nginx/sites-enabled/ltride
rm -f /etc/nginx/sites-enabled/default   # drop the "Welcome to nginx" placeholder
nginx -t                                  # fail loudly if the config is invalid

# --- 5. run migrations + start ----------------------------------------------
log "applying database migrations"
sudo -u "$APP_USER" bash -lc "
    cd '$APP_DIR'
    set -a; . .env; set +a
    for f in webapp/sql/migrations/*.sql; do
        [ -e \"\$f\" ] || continue
        echo \"  -> \$f\"
        psql \"\$DATABASE_URL\" -f \"\$f\"
    done
"

log "starting services"
systemctl restart ltride
systemctl reload nginx

log "done. Check:  systemctl status ltride   and   curl -s http://127.0.0.1:8000/api/health"
