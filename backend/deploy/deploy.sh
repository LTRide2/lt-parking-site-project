#!/usr/bin/env bash
#
# deploy.sh — provision/update the LTRide EC2 + RDS stack via CloudFormation.
#
# Deploys the four stacks in dependency order:
#   ltride-network  -> ltride-database -> ltride-compute -> ltride-dns
#
# Usage:
#   ./deploy.sh [up|down|validate|status|outputs] [env]
#
#   up        (default) create/update all stacks in order
#   down      delete all stacks in REVERSE order (DB leaves a final snapshot)
#   validate  validate every template, no changes made
#   status    show the status of each stack
#   outputs   print the Outputs of each stack
#
#   env       parameter set under params/<env>.json (default: prod)
#
# Env vars:
#   AWS_REGION   target region (default: us-east-1)
#   AWS_PROFILE  optional named profile, passed through to the aws CLI
#
set -euo pipefail

# ---- config -----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFN_DIR="${SCRIPT_DIR}/cfn"
PARAMS_DIR="${SCRIPT_DIR}/params"

ACTION="${1:-up}"
ENVNAME="${2:-prod}"
REGION="${AWS_REGION:-us-east-1}"
PROJECT="ltride"

PARAM_FILE="${PARAMS_DIR}/${ENVNAME}.json"

# Stacks in dependency order: "<stack-suffix>:<template-file>"
STACKS=(
  "network:01-network.yaml"
  "database:02-database.yaml"
  "compute:03-compute.yaml"
  "dns:04-dns.yaml"
)

# IAM-creating stacks need an explicit capability.
needs_iam() { [[ "$1" == "network" || "$1" == "compute" ]]; }

# ---- helpers ----------------------------------------------------------------
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; }

aws_cli() { aws --region "$REGION" "$@"; }

stack_name() { echo "${PROJECT}-${1}"; }

ensure_aws_cli() {
  command -v aws >/dev/null 2>&1 && return 0

  log "aws CLI not found — attempting install"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if ! command -v brew >/dev/null 2>&1; then
      err "Homebrew not found. Install it from https://brew.sh then re-run, or install the AWS CLI manually."
      exit 1
    fi
    log "installing awscli via Homebrew"
    brew install awscli
  else
    err "aws CLI not found and auto-install is only supported on macOS (Homebrew)."
    err "Install it: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
  fi

  command -v aws >/dev/null 2>&1 || { err "aws CLI still not on PATH after install"; exit 1; }
  ok "aws CLI installed ($(aws --version 2>&1))"
}

preflight() {
  ensure_aws_cli
  [[ -d "$CFN_DIR" ]] || { err "missing templates dir: $CFN_DIR"; exit 1; }
  if [[ "$ACTION" != "down" && "$ACTION" != "status" && "$ACTION" != "outputs" ]]; then
    [[ -f "$PARAM_FILE" ]] || { err "missing params file: $PARAM_FILE"; exit 1; }
  fi
  aws_cli sts get-caller-identity >/dev/null 2>&1 || { err "AWS credentials not configured"; exit 1; }
  ok "preflight passed (region=$REGION, env=$ENVNAME)"
}

validate_all() {
  for entry in "${STACKS[@]}"; do
    local tmpl="${CFN_DIR}/${entry#*:}"
    log "validating ${entry#*:}"
    aws_cli cloudformation validate-template --template-body "file://${tmpl}" >/dev/null
    ok "valid: ${entry#*:}"
  done
}

deploy_all() {
  for entry in "${STACKS[@]}"; do
    local suffix="${entry%%:*}"
    local tmpl="${CFN_DIR}/${entry#*:}"
    local name; name="$(stack_name "$suffix")"
    local caps=()
    needs_iam "$suffix" && caps=(--capabilities CAPABILITY_NAMED_IAM)

    log "deploying ${name}"
    aws_cli cloudformation deploy \
      --stack-name "$name" \
      --template-file "$tmpl" \
      --parameter-overrides "file://${PARAM_FILE}" \
      --no-fail-on-empty-changeset \
      "${caps[@]}"
    ok "deployed ${name}"
  done
  log "all stacks up to date"
  outputs_all
}

delete_all() {
  # reverse order
  for (( i=${#STACKS[@]}-1; i>=0; i-- )); do
    local suffix="${STACKS[$i]%%:*}"
    local name; name="$(stack_name "$suffix")"
    log "deleting ${name}"
    aws_cli cloudformation delete-stack --stack-name "$name"
    aws_cli cloudformation wait stack-delete-complete --stack-name "$name" 2>/dev/null \
      && ok "deleted ${name}" || err "delete may still be in progress for ${name}"
  done
}

status_all() {
  for entry in "${STACKS[@]}"; do
    local name; name="$(stack_name "${entry%%:*}")"
    local st
    st="$(aws_cli cloudformation describe-stacks --stack-name "$name" \
          --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo 'NOT_CREATED')"
    printf '  %-20s %s\n' "$name" "$st"
  done
}

outputs_all() {
  for entry in "${STACKS[@]}"; do
    local name; name="$(stack_name "${entry%%:*}")"
    aws_cli cloudformation describe-stacks --stack-name "$name" \
      --query 'Stacks[0].Outputs' --output table 2>/dev/null \
      && true || true
  done
}

# ---- main -------------------------------------------------------------------
preflight
case "$ACTION" in
  up)       validate_all; deploy_all ;;
  down)     delete_all ;;
  validate) validate_all ;;
  status)   status_all ;;
  outputs)  outputs_all ;;
  *)        err "unknown action: $ACTION"; echo "usage: ./deploy.sh [up|down|validate|status|outputs] [env]"; exit 2 ;;
esac
