#!/usr/bin/env bash
# Concern 4 of 4: APPLICATION. Ships code to the already-provisioned EC2 box:
#   backend   pull latest code + reinstall Python deps + restart gunicorn, then
#             health-check /api/health
#   frontend  build frontend/ with the production API URL + rsync dist/ into the
#             nginx web root
# Infrastructure (VPC/RDS/EC2) comes from 'infra'; schema changes come from 'db'.
# On a schema change run 'db migrate' before this. See deploy/README.md.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-common.sh"

deploy_backend() {
  prepare_ssh || exit 1
  echo ">> releasing backend to ${ssh_host}"
  remote sudo -u ltride bash -se <<REMOTE
set -euo pipefail
cd "${remote_app_directory}"
git pull --ff-only
cd "${remote_backend_directory}"
.venv/bin/pip install -q -r webapp/requirements.txt
REMOTE
  echo ">> restarting service"
  remote sudo systemctl restart ltride
  remote sudo systemctl --no-pager --lines=0 status ltride || true
  if remote "curl -fsS http://127.0.0.1:8000/api/health" >/dev/null; then
    echo "backend healthy."
  else
    echo "backend health check failed." >&2; exit 1
  fi
}

deploy_frontend() {
  prepare_ssh || exit 1
  [ -d "$frontend_directory" ] || { echo "frontend directory not found: ${frontend_directory}" >&2; exit 1; }
  # The site calls the API at the public domain when set, otherwise the box IP.
  local domain_name; domain_name="$(parameter_value DomainName || true)"
  local api_base_url="https://${domain_name:-$ssh_host}"

  echo ">> building frontend (VITE_API_URL=${api_base_url})"
  ( cd "$frontend_directory"
    [ -d node_modules ] || npm ci
    VITE_API_URL="$api_base_url" npm run build )

  echo ">> uploading dist/ to ${ssh_host}:${remote_web_root}"
  # Stage to a temp dir first, then move into the web root with sudo (the ltride
  # web root is not writable by the SSH user directly).
  rsync -az --delete -e "ssh -i ${ssh_key_path} -o StrictHostKeyChecking=accept-new" \
    "${frontend_directory}/dist/" "${ssh_user}@${ssh_host}:/tmp/ltride-dist/"
  remote "sudo mkdir -p '${remote_web_root}' && sudo rsync -a --delete /tmp/ltride-dist/ '${remote_web_root}/' && rm -rf /tmp/ltride-dist"
  remote "sudo nginx -t && sudo systemctl reload nginx"
  echo "frontend deployed -> ${api_base_url}"
}

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-app.sh <command>   (concern 4 of 4: application)

  frontend  Build frontend/ (VITE_API_URL from DomainName) + rsync dist/ to nginx
  backend   Pull latest code + reinstall deps + restart gunicorn + health check
  all       backend then frontend

Requires the box to exist (scripts/deploy.sh infra up). For schema changes, run
'scripts/deploy.sh db migrate' before this.
USAGE
}

command_name="${1:-all}"
case "$command_name" in
  all)      deploy_backend; deploy_frontend ;;
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  -h|--help|help) usage ;;
  *) echo "unknown command: $command_name" >&2; usage; exit 2 ;;
esac
