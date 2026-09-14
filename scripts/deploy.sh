#!/usr/bin/env bash
# deploy.sh — credential-checked entrypoint over the four concern-scoped deploy
# scripts. It optionally sources scripts/aws-credential.sh for AWS keys, verifies
# credentials with 'aws sts get-caller-identity', then dispatches to one group:
#   secrets   Secrets Manager bootstrap: create/rotate the DB + app secrets
#   infra     CloudFormation stacks only (network -> database -> compute -> dns)
#   db        SQL migrations on the box against the private RDS instance
#   app       Build + ship the frontend, and pull + restart the backend
# 'all' walks the whole first-boot flow interactively. infra/db/app all depend
# on the secrets existing, so 'secrets' is the bootstrap group. See deploy/README.md.
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
credential_file="$script_directory/aws-credential.sh"

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy.sh [-e <env>] all
  scripts/deploy.sh [-e <env>] destroy
  scripts/deploy.sh [-e <env>] <secrets|infra|db|app> [subcommand ...]
  scripts/deploy.sh [-e <env>] -t <secrets|infra|db|app>
  scripts/deploy.sh <secrets|infra|db|app> help

Loads AWS credentials from scripts/aws-credential.sh if present (otherwise your
default AWS profile is used), verifies them with 'aws sts get-caller-identity',
then runs the requested step. There are four concern groups (default subcommand
in [brackets]):

  secrets  -> scripts/deploy-secrets.sh   [list]
           scripts/deploy.sh secrets init            # create the DB + app secret stack
           scripts/deploy.sh secrets list            # show every secret's name and value
           scripts/deploy.sh secrets secret_key <v>  # set/rotate one named value
           scripts/deploy.sh secrets destroy         # delete the secrets stack (prompts)

  infra    -> scripts/deploy-infra.sh      [up]
           scripts/deploy.sh infra up                # network -> database -> compute -> dns
           scripts/deploy.sh infra down              # delete those stacks (reverse; prompts)
           scripts/deploy.sh infra status            # per-stack status
           scripts/deploy.sh infra outputs           # per-stack outputs
           scripts/deploy.sh infra validate          # validate every template

  db       -> scripts/deploy-db.sh         [migrate]
           scripts/deploy.sh db migrate              # apply backend/webapp/sql/migrations/*.sql

  app      -> scripts/deploy-app.sh        [all]
           scripts/deploy.sh app frontend            # build frontend/ + rsync dist/ to nginx
           scripts/deploy.sh app backend             # pull code + reinstall deps + restart
           scripts/deploy.sh app all                 # backend then frontend

  all      Guided first-boot flow — create the secrets if absent, then (with a
           confirmation at each step) bring up the infrastructure, run the DB
           migrations, and release the app. Every step is idempotent.
           scripts/deploy.sh all

  destroy  Guided teardown — the reverse of 'all'. After one typed confirmation
           it deletes the CloudFormation stacks (dns -> compute -> database ->
           network; RDS keeps a final snapshot), then asks whether to also
           delete the secrets stack (kept by default).
           scripts/deploy.sh destroy

Options:
  -e, --env <name>       Parameter set under deploy/params/<name>.json (default: prod).
  -t, --target <t>       Alias for a bare '<t>' run with its default subcommand.
  -h, --help             Show this help.

Environment:
  AWS_REGION             AWS region (default: us-east-1).
  SSH_KEY                Path to the EC2 private key (default: ~/.ssh/<KeyName>.pem).
  EC2_HOST               Override the box IP (default: read from the compute stack).
USAGE
}

load_credentials() {
  # Source the credential file when present, then verify whatever credentials
  # are in effect. The file is optional: without it the default AWS profile /
  # environment is used, which suits 'aws configure' setups.
  if [ -f "$credential_file" ]; then
    # shellcheck source=/dev/null
    source "$credential_file"
    resolve_aws_region
  fi
  if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "AWS credentials are not configured or were rejected by 'aws sts get-caller-identity'." >&2
    echo "Run 'aws configure', or create ${credential_file} (see aws-credential.sh.example)." >&2
    exit 1
  fi
}

confirm() {
  # confirm "<question>" — prompt (default yes); return 0 on yes.
  local answer
  read -r -p "$1 [Y/n] " answer
  case "${answer:-y}" in y|Y|yes|YES|Yes) return 0 ;; *) return 1 ;; esac
}

guided_all() {
  # Walk the first-boot sequence, skipping anything already satisfied. Each
  # concern is delegated to its own script so the logic lives in one place.
  local secrets_stack; secrets_stack="$(stack_name secrets)"
  echo "== Guided deploy for '${environment_name}' (region ${aws_region}) =="

  if stack_exists "$secrets_stack"; then
    echo "[1/4 secrets] ${secrets_stack} already exists."
  else
    echo "[1/4 secrets] creating ${secrets_stack} ..."
    "$script_directory/deploy-secrets.sh" init
  fi

  if confirm "[2/4 infra] deploy/update the CloudFormation stacks now?"; then
    "$script_directory/deploy-infra.sh" up
  else echo "[2/4 infra] skipped."; fi

  if confirm "[3/4 db] apply SQL migrations on the box?"; then
    "$script_directory/deploy-db.sh" migrate
  else echo "[3/4 db] skipped."; fi

  if confirm "[4/4 app] build + ship the frontend and restart the backend?"; then
    "$script_directory/deploy-app.sh" all
  else echo "[4/4 app] skipped."; fi

  echo "== Guided deploy complete for '${environment_name}'. =="
}

guided_destroy() {
  # Symmetric teardown of 'all': delete the CloudFormation stacks (reverse
  # order) and optionally the secrets. One top-level confirmation gates the
  # whole flow; LTRIDE_ASSUME_YES then suppresses the per-script prompts.
  echo "== Guided TEARDOWN for '${environment_name}' (region ${aws_region}) =="
  echo "Deletes stacks dns -> compute -> database -> network (RDS keeps a final"
  echo "snapshot). Secrets are deleted only if you opt in at the end."
  local typed_confirmation
  read -r -p "This cannot be undone. Type '${environment_name}' to proceed: " typed_confirmation
  [ "$typed_confirmation" = "$environment_name" ] || { echo "confirmation did not match; aborted." >&2; exit 1; }

  export LTRIDE_ASSUME_YES=1
  "$script_directory/deploy-infra.sh" down

  local answer
  read -r -p "[secrets] also delete the secrets stack (schedules secret deletion)? [y/N] " answer
  case "${answer:-n}" in
    y|Y|yes|YES|Yes) "$script_directory/deploy-secrets.sh" destroy ;;
    *) echo "[secrets] kept." ;;
  esac
  echo "== Teardown complete for '${environment_name}'. =="
}

environment_name="${ENVIRONMENT_NAME:-prod}"
target_name=""
run_all="false"
run_destroy="false"
forwarded_arguments=()

while [ $# -gt 0 ]; do
  case "$1" in
    -e|--env)
      environment_name="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
    --env=*)
      environment_name="${1#*=}"; shift ;;
    -t|--target)
      target_name="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
    --target=*)
      target_name="${1#*=}"; shift ;;
    all)     run_all="true"; shift ;;
    destroy) run_destroy="true"; shift ;;
    secrets|infra|app|db)
      target_name="$1"; shift; forwarded_arguments=("$@"); break ;;
    -h|--help|help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

export ENVIRONMENT_NAME="$environment_name"
# Source the shared helpers AFTER the export so stack_name/environment_name
# resolve to the selected environment.
# shellcheck source=/dev/null
source "$script_directory/lib/deploy-common.sh"

if [ "$run_all" = "true" ]; then
  load_credentials; guided_all; exit 0
fi

if [ "$run_destroy" = "true" ]; then
  load_credentials; guided_destroy; exit 0
fi

if [ -z "$target_name" ]; then
  usage; exit 0
fi

case "$target_name" in
  secrets|infra|app|db) ;;
  *) echo "unknown target: $target_name (expected secrets | infra | db | app)" >&2; usage; exit 2 ;;
esac

# Fill in the default subcommand when the caller forwarded none.
if [ "${#forwarded_arguments[@]}" -eq 0 ]; then
  case "$target_name" in
    secrets) forwarded_arguments=(list) ;;
    infra)   forwarded_arguments=(up) ;;
    app)     forwarded_arguments=(all) ;;
    db)      forwarded_arguments=(migrate) ;;
  esac
fi

# Help is credential-free; every other subcommand needs verified credentials.
case "${forwarded_arguments[0]}" in
  help|-h|--help) ;;
  *) load_credentials ;;
esac

"$script_directory/deploy-${target_name}.sh" "${forwarded_arguments[@]}"
