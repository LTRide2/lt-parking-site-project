#!/usr/bin/env bash
# Concern 3 of 4: DATABASE. Applies SQL migrations against the private RDS
# instance. RDS is not reachable from your laptop (it only accepts connections
# from the web security group), so migrations run ON the box over SSH: pull the
# latest code, then apply backend/webapp/sql/migrations/*.sql with psql using
# the DATABASE_URL from the box's .env. Run this BEFORE 'app' on a schema change
# so the new columns exist before the new code serves traffic. See deploy/README.md.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-common.sh"

run_migrations() {
  prepare_ssh || exit 1
  echo ">> applying migrations on ${ssh_host}"
  # Runs as the ltride service user. Pull first so the newest migration files
  # are present, then apply every *.sql in order. psql stops on the first error.
  remote sudo -u ltride bash -se <<REMOTE
set -euo pipefail
cd "${remote_app_directory}"
git pull --ff-only
cd "${remote_backend_directory}"
set -a; . .env; set +a
shopt -s nullglob
for migration_file in webapp/sql/migrations/*.sql; do
  echo "  -> \${migration_file}"
  psql "\$DATABASE_URL" -v ON_ERROR_STOP=1 -f "\${migration_file}"
done
REMOTE
  echo "migrations applied."
}

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-db.sh <command>   (concern 3 of 4: database)

  migrate   Pull latest code on the box, then apply
            backend/webapp/sql/migrations/*.sql against RDS (psql, stop-on-error)

Run this before 'scripts/deploy.sh app' whenever a release changes the schema,
so the migration lands before the new code serves traffic.
USAGE
}

command_name="${1:-migrate}"
case "$command_name" in
  migrate) run_migrations ;;
  -h|--help|help) usage ;;
  *) echo "unknown command: $command_name" >&2; usage; exit 2 ;;
esac
