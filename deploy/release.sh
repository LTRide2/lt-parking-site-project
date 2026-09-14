#!/usr/bin/env bash
#
# release.sh — deploy the LTRide application code (UI + backend) to the
# already-provisioned EC2 instance.
#
# Infra (VPC/RDS/EC2) is created by deploy.sh (CloudFormation). This script
# ships *code* to that running instance:
#   backend  -> git pull + pip install + DB migrate + restart gunicorn
#   frontend -> npm build (with prod API URL) + rsync dist/ to nginx web root
#
# Usage:
#   ./release.sh [all|backend|frontend] [env]
#
#   all       (default) deploy backend then frontend
#   backend   backend only
#   frontend  frontend only
#   env       parameter/stack env (default: prod)
#
# Env vars:
#   AWS_REGION    target region (default: us-east-1)
#   AWS_PROFILE   optional named profile, passed through to the aws CLI
#   SSH_KEY       path to the EC2 private key (default: ~/.ssh/<KeyName>.pem)
#   SSH_USER      remote user (default: ubuntu)
#   EC2_HOST      override host/IP (default: read from compute stack outputs)
#   UI_DIR        path to the frontend repo (default: ../lt-parking-site-project)
#   WEB_ROOT      nginx web root on the server (default: /var/www/ltride)
#   APP_DIR       backend checkout on the server (default: /home/ltride/app)
#
set -euo pipefail

# ---- config -----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PARAMS_DIR="${SCRIPT_DIR}/params"

TARGET="${1:-all}"
ENVNAME="${2:-prod}"
REGION="${AWS_REGION:-us-east-1}"
PROJECT="ltride"
COMPUTE_STACK="${PROJECT}-compute"

SSH_USER="${SSH_USER:-ubuntu}"
UI_DIR="${UI_DIR:-${BACKEND_DIR}/../lt-parking-site-project}"
WEB_ROOT="${WEB_ROOT:-/var/www/ltride}"
APP_DIR="${APP_DIR:-/home/ltride/app}"
PARAM_FILE="${PARAMS_DIR}/${ENVNAME}.json"

# ---- helpers ----------------------------------------------------------------
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; }

aws_cli() { aws --region "$REGION" "$@"; }

# read "Key=Value" out of params/<env>.json
param() {
  local key="$1"
  [[ -f "$PARAM_FILE" ]] || return 1
  grep -oE "\"${key}=[^\"]*\"" "$PARAM_FILE" | head -1 | sed -E "s/\"${key}=(.*)\"/\1/"
}

# stack output value by OutputKey
stack_output() {
  aws_cli cloudformation describe-stacks --stack-name "$COMPUTE_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text 2>/dev/null
}

resolve_host() {
  if [[ -n "${EC2_HOST:-}" ]]; then echo "$EC2_HOST"; return 0; fi
  local ip; ip="$(stack_output ElasticIp)"
  [[ -z "$ip" || "$ip" == "None" ]] && ip="$(stack_output PublicIp)"
  if [[ -z "$ip" || "$ip" == "None" ]]; then
    err "could not read EC2 host from stack '$COMPUTE_STACK'. Set EC2_HOST=<ip> to override."
    exit 1
  fi
  echo "$ip"
}

resolve_ssh_key() {
  if [[ -n "${SSH_KEY:-}" ]]; then echo "$SSH_KEY"; return 0; fi
  local name; name="$(param KeyName || true)"
  echo "${HOME}/.ssh/${name:-ltride-key}.pem"
}

DOMAIN="$(param DomainName || true)"

# ---- preflight --------------------------------------------------------------
preflight() {
  command -v aws  >/dev/null 2>&1 || { err "aws CLI not found (run ./deploy.sh first)"; exit 1; }
  command -v ssh  >/dev/null 2>&1 || { err "ssh not found"; exit 1; }
  command -v rsync>/dev/null 2>&1 || { err "rsync not found"; exit 1; }
  aws_cli sts get-caller-identity >/dev/null 2>&1 || { err "AWS credentials not configured"; exit 1; }

  HOST="$(resolve_host)"
  KEY="$(resolve_ssh_key)"
  [[ -f "$KEY" ]] || { err "SSH key not found: $KEY (set SSH_KEY=...)"; exit 1; }
  chmod 600 "$KEY" 2>/dev/null || true
  SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${HOST}")
  ok "target: ${SSH_USER}@${HOST}  (key: $KEY)"
}

remote() { "${SSH[@]}" "$@"; }

# ---- backend ----------------------------------------------------------------
deploy_backend() {
  log "deploying backend to ${HOST}"
  remote sudo -u ltride bash -se <<REMOTE
set -euo pipefail
cd "${APP_DIR}"
echo "  pulling latest code"
git pull --ff-only
echo "  installing dependencies"
.venv/bin/pip install -q -r requirements.txt
echo "  applying DB migrations (if any)"
set -a; . "${APP_DIR}/.env"; set +a
for f in sql/migrations/*.sql; do
  [ -e "\$f" ] || continue
  echo "    -> \$f"
  psql "\$DATABASE_URL" -f "\$f"
done
REMOTE
  log "restarting service"
  remote sudo systemctl restart ltride
  remote sudo systemctl --no-pager --lines=0 status ltride || true
  log "health check"
  if remote "curl -fsS http://127.0.0.1:8000/api/health" >/dev/null; then
    ok "backend healthy"
  else
    err "backend health check failed"; exit 1
  fi
}

# ---- frontend ---------------------------------------------------------------
deploy_frontend() {
  log "building frontend in ${UI_DIR}"
  [[ -d "$UI_DIR" ]] || { err "UI dir not found: $UI_DIR (set UI_DIR=...)"; exit 1; }
  local api_url="https://${DOMAIN:-$HOST}"

  ( cd "$UI_DIR"
    [[ -d node_modules ]] || npm ci
    VITE_API_URL="$api_url" npm run build )
  ok "built with VITE_API_URL=${api_url}"

  log "uploading dist/ to ${HOST}:${WEB_ROOT}"
  # stage to a temp dir, then move into web root with sudo
  rsync -az --delete -e "ssh -i ${KEY} -o StrictHostKeyChecking=accept-new" \
    "${UI_DIR}/dist/" "${SSH_USER}@${HOST}:/tmp/ltride-dist/"
  remote "sudo mkdir -p '${WEB_ROOT}' && sudo rsync -a --delete /tmp/ltride-dist/ '${WEB_ROOT}/' && rm -rf /tmp/ltride-dist"
  remote "sudo nginx -t && sudo systemctl reload nginx"
  ok "frontend deployed -> ${api_url}"
}

# ---- main -------------------------------------------------------------------
preflight
case "$TARGET" in
  all)      deploy_backend; deploy_frontend ;;
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  *)        err "unknown target: $TARGET"; echo "usage: ./release.sh [all|backend|frontend] [env]"; exit 2 ;;
esac
log "release complete"
