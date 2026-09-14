#!/usr/bin/env bash
# Concern 2 of 4: INFRASTRUCTURE. Deploys the CloudFormation stacks only, in
# dependency order (network -> database -> compute -> dns). No secrets, no
# migrations, no app release — those are the other three concern scripts. The
# database stack resolves the RDS password from the secrets stack, so 'secrets
# init' must run first. See deploy/README.md.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-common.sh"

# Stacks in dependency order: "<suffix>:<template>". Only the compute stack
# creates named IAM resources, so only it needs CAPABILITY_NAMED_IAM.
infrastructure_stacks=(
  "network:01-network.yaml"
  "database:02-database.yaml"
  "compute:03-compute.yaml"
  "dns:04-dns.yaml"
)
stack_needs_named_iam() { [ "$1" = "compute" ]; }

require_secrets_present() {
  # The database stack cannot resolve its RDS credentials until the secrets
  # stack exists. Fail early with a clear pointer rather than a cryptic CFN error.
  if ! secret_has_keys "${project_name}/db" username password; then
    echo "secrets not ready: ${project_name}/db is missing username/password." >&2
    echo "Run 'scripts/deploy.sh secrets init' before 'infra up'." >&2
    return 1
  fi
}

deploy_infrastructure() {
  require_secrets_present || exit 1
  local entry suffix template capability_arguments
  for entry in "${infrastructure_stacks[@]}"; do
    suffix="${entry%%:*}"; template="${entry#*:}"
    capability_arguments=()
    stack_needs_named_iam "$suffix" && capability_arguments=(--capabilities CAPABILITY_NAMED_IAM)
    deploy_stack "$suffix" "$template" ${capability_arguments[@]+"${capability_arguments[@]}"}
  done
  echo "infrastructure deployed."
  show_outputs
}

destroy_infrastructure() {
  # Delete in reverse dependency order (network is imported by the others, so it
  # goes last). RDS keeps a final snapshot (02-database.yaml DeletionPolicy).
  confirm_destroy "the CloudFormation stacks (dns, compute, database, network)" || exit 1
  echo "== Destroying infrastructure for '${environment_name}' =="
  local index suffix
  for (( index=${#infrastructure_stacks[@]}-1; index>=0; index-- )); do
    suffix="${infrastructure_stacks[$index]%%:*}"
    delete_stack "$suffix"
  done
  echo "infrastructure destroyed. RDS left a final snapshot."
  echo "Secrets are NOT deleted here — run 'scripts/deploy.sh secrets destroy' to remove them."
}

validate_templates() {
  local entry template
  for entry in "${infrastructure_stacks[@]}"; do
    template="${cloudformation_directory}/${entry#*:}"
    echo ">> validating ${entry#*:}"
    run_aws cloudformation validate-template --template-body "file://${template}" >/dev/null
  done
  echo "all templates valid."
}

show_status() {
  local entry resolved_stack_name status_value
  for entry in "${infrastructure_stacks[@]}"; do
    resolved_stack_name="$(stack_name "${entry%%:*}")"
    status_value="$(run_aws cloudformation describe-stacks --stack-name "$resolved_stack_name" \
      --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo NOT_CREATED)"
    printf '  %-20s %s\n' "$resolved_stack_name" "$status_value"
  done
}

show_outputs() {
  local entry resolved_stack_name
  for entry in "${infrastructure_stacks[@]}"; do
    resolved_stack_name="$(stack_name "${entry%%:*}")"
    run_aws cloudformation describe-stacks --stack-name "$resolved_stack_name" \
      --query 'Stacks[0].Outputs' --output table 2>/dev/null || true
  done
}

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-infra.sh <command>   (concern 2 of 4: infrastructure)

  up        Deploy stacks in order: network, database, compute, dns
  down      Delete them in reverse order (RDS keeps a final snapshot; prompts)
  status    Show each stack's status
  outputs   Show each stack's outputs
  validate  Validate every template, making no changes

The database stack reads the RDS credentials from the secrets stack, so run
'scripts/deploy.sh secrets init' first. After 'up', migrate the DB
(scripts/deploy.sh db migrate) and release the app (scripts/deploy.sh app all).
USAGE
}

command_name="${1:-up}"
case "$command_name" in
  up)       deploy_infrastructure ;;
  down)     destroy_infrastructure ;;
  status)   show_status ;;
  outputs)  show_outputs ;;
  validate) validate_templates ;;
  -h|--help|help) usage ;;
  *) echo "unknown command: $command_name" >&2; usage; exit 2 ;;
esac
