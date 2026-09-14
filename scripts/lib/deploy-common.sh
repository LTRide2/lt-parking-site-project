#!/usr/bin/env bash
# Shared helpers for the four concern-scoped deploy scripts (secrets / infra /
# db / app) and the scripts/deploy.sh entrypoint. Sourced, never executed
# directly. Defines the target environment, thin AWS wrappers, CloudFormation
# stack + Secrets Manager resolvers, and the SSH helpers the db/app concerns use
# to reach the EC2 box. Keeping them here keeps the concern scripts DRY.

# Resolve the monorepo layout from THIS file's location, not the caller's, so
# every concern script sees the same paths regardless of where it is invoked.
deploy_common_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scripts_directory="$(cd "$deploy_common_directory/.." && pwd)"
repository_root="$(cd "$scripts_directory/.." && pwd)"
deploy_directory="$repository_root/deploy"
cloudformation_directory="$deploy_directory/cfn"
parameters_directory="$deploy_directory/params"
frontend_directory="$repository_root/frontend"
backend_directory="$repository_root/backend"

# The environment name selects which parameter file (params/<env>.json) is
# passed to every stack. Stack names themselves are NOT env-scoped (they stay
# ltride-<suffix>), so this project supports one environment per account/region.
environment_name="${ENVIRONMENT_NAME:-prod}"
project_name="ltride"

resolve_aws_region() {
  # Default region is us-east-1; export it so child concern scripts and the AWS
  # CLI all agree on one region.
  aws_region="${AWS_REGION:-us-east-1}"
  export AWS_REGION="$aws_region"
}
resolve_aws_region

parameter_file="$parameters_directory/${environment_name}.json"

run_aws() { aws --region "$aws_region" "$@"; }

stack_name() {
  # stack_name <suffix> — the CloudFormation stack name for one concern.
  printf '%s-%s' "$project_name" "$1"
}

parameter_value() {
  # parameter_value <key> — read one "Key=Value" entry out of the parameter
  # file (params/<env>.json is a JSON array of "Key=Value" strings).
  local key="$1"
  [ -f "$parameter_file" ] || return 1
  grep -oE "\"${key}=[^\"]*\"" "$parameter_file" | head -1 | sed -E "s/\"${key}=(.*)\"/\1/"
}

stack_output() {
  # stack_output <stack-name> <OutputKey>
  run_aws cloudformation describe-stacks --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text 2>/dev/null
}

require_stack_output() {
  # require_stack_output <var-name> <stack-name> <OutputKey> — set the named
  # global or return non-zero. Assigning a global with printf -v (rather than
  # echoing from a subshell) keeps a failing exit in the caller's shell.
  local target_variable="$1" stack_name_value="$2" output_key="$3" resolved_value
  resolved_value="$(stack_output "$stack_name_value" "$output_key")"
  if [ -z "$resolved_value" ] || [ "$resolved_value" = "None" ]; then
    echo "missing output ${output_key} from ${stack_name_value}; run 'deploy.sh infra up' first." >&2
    return 1
  fi
  printf -v "$target_variable" '%s' "$resolved_value"
}

stack_exists() {
  # stack_exists <stack-name> — quiet 0/1; true when the stack is present.
  run_aws cloudformation describe-stacks --stack-name "$1" >/dev/null 2>&1
}

deploy_stack() {
  # deploy_stack <suffix> <template> [extra deploy args...] — deploy one stack,
  # passing the whole parameter file (every template declares all six keys, so
  # the same file is valid for each). Idempotent: no-op on an empty change set.
  local name_suffix="$1" template="$2"; shift 2
  local resolved_stack_name; resolved_stack_name="$(stack_name "$name_suffix")"
  echo ">> deploying ${resolved_stack_name} (${template})"
  run_aws cloudformation deploy \
    --stack-name "$resolved_stack_name" \
    --template-file "${cloudformation_directory}/${template}" \
    --parameter-overrides "file://${parameter_file}" \
    --no-fail-on-empty-changeset "$@"
}

delete_stack() {
  # delete_stack <suffix> — delete one stack and wait for completion; a no-op
  # (with a note) when the stack is absent.
  local name_suffix="$1"
  local resolved_stack_name; resolved_stack_name="$(stack_name "$name_suffix")"
  if ! stack_exists "$resolved_stack_name"; then
    echo "-- ${resolved_stack_name}: not present, skipping."
    return 0
  fi
  echo ">> deleting ${resolved_stack_name}"
  run_aws cloudformation delete-stack --stack-name "$resolved_stack_name"
  echo "   waiting for ${resolved_stack_name} to be deleted ..."
  run_aws cloudformation wait stack-delete-complete --stack-name "$resolved_stack_name"
  echo "   ${resolved_stack_name} deleted."
}

confirm_destroy() {
  # confirm_destroy "<what>" — guard a destructive action. Returns 0 to proceed.
  # An outer guided flow that already confirmed sets LTRIDE_ASSUME_YES=1 to skip
  # the prompt; otherwise the operator must type the exact environment name.
  if [ "${LTRIDE_ASSUME_YES:-}" = 1 ]; then return 0; fi
  echo "About to DESTROY ${1} for environment '${environment_name}' (region ${aws_region})." >&2
  local typed_confirmation
  read -r -p "This cannot be undone. Type '${environment_name}' to confirm: " typed_confirmation
  if [ "$typed_confirmation" != "$environment_name" ]; then
    echo "confirmation did not match; aborting." >&2
    return 1
  fi
}

read_json_field() {
  # read_json_field <json> <key> [default] — one string field; tolerates
  # empty/absent JSON by falling back to the default (or empty).
  printf '%s' "$1" | python3 -c \
    'import json,sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ""))' \
    "$2" "${3:-}" 2>/dev/null || true
}

get_secret_json() {
  # get_secret_json <secret-id> — echo the secret's SecretString, or nothing
  # when it has no value / does not exist.
  run_aws secretsmanager get-secret-value --secret-id "$1" \
    --query SecretString --output text 2>/dev/null || true
}

secret_exists() {
  # secret_exists <secret-id> — quiet 0/1; true when the secret exists.
  run_aws secretsmanager describe-secret --secret-id "$1" >/dev/null 2>&1
}

secret_has_keys() {
  # secret_has_keys <secret-id> <key...> — quiet 0/1; true when every listed key
  # holds a non-empty value in the secret's JSON.
  local secret_id="$1"; shift
  local secret_json; secret_json="$(get_secret_json "$secret_id")"
  local key
  for key in "$@"; do
    [ -n "$(read_json_field "$secret_json" "$key")" ] || return 1
  done
}

put_secret_key() {
  # put_secret_key <secret-id> <key> <value> — merge one key onto the secret's
  # existing JSON and write it back. The value reaches python via the
  # environment and the AWS CLI via a 0600 temp file, never on a command line.
  local secret_id="$1" key="$2" value="$3"
  local existing_json; existing_json="$(get_secret_json "$secret_id")"
  local merged_json
  merged_json="$(EXISTING_JSON="$existing_json" SECRET_KEY_NAME="$key" SECRET_VALUE="$value" python3 -c '
import json, os
existing = json.loads(os.environ.get("EXISTING_JSON") or "{}")
existing[os.environ["SECRET_KEY_NAME"]] = os.environ["SECRET_VALUE"]
print(json.dumps(existing))')"
  umask 077
  local temporary_secret_file; temporary_secret_file="$(mktemp "${TMPDIR:-/tmp}/ltride-secret.XXXXXX")"
  printf '%s' "$merged_json" >"$temporary_secret_file"
  local exit_code=0
  run_aws secretsmanager put-secret-value --secret-id "$secret_id" \
    --secret-string "file://$temporary_secret_file" >/dev/null || exit_code=$?
  rm -f "$temporary_secret_file"
  return $exit_code
}

# --- SSH helpers (used by the db + app concerns to reach the EC2 box) --------

ssh_user="${SSH_USER:-ubuntu}"

# Where the monorepo is cloned on the box and where nginx serves the built site.
# The backend (Flask app + venv + .env) lives under the repo's backend/ subdir,
# so gunicorn's "webapp.App:app" import resolves from that working directory.
remote_app_directory="${REMOTE_APP_DIR:-/home/ltride/app}"
remote_backend_directory="${remote_app_directory}/backend"
remote_web_root="${WEB_ROOT:-/var/www/ltride}"

resolve_ssh_host() {
  # Set the global ssh_host from EC2_HOST, else the compute stack's ElasticIp,
  # else its PublicIp. Returns non-zero (with guidance) when none resolves.
  if [ -n "${EC2_HOST:-}" ]; then ssh_host="$EC2_HOST"; return 0; fi
  local compute_stack; compute_stack="$(stack_name compute)"
  ssh_host="$(stack_output "$compute_stack" ElasticIp)"
  if [ -z "$ssh_host" ] || [ "$ssh_host" = "None" ]; then
    ssh_host="$(stack_output "$compute_stack" PublicIp)"
  fi
  if [ -z "$ssh_host" ] || [ "$ssh_host" = "None" ]; then
    echo "could not read the EC2 host from ${compute_stack}; set EC2_HOST=<ip> to override." >&2
    return 1
  fi
}

resolve_ssh_key() {
  # Set the global ssh_key_path from SSH_KEY, else ~/.ssh/<KeyName>.pem where
  # KeyName comes from the parameter file.
  if [ -n "${SSH_KEY:-}" ]; then ssh_key_path="$SSH_KEY"; return 0; fi
  local key_name; key_name="$(parameter_value KeyName || true)"
  ssh_key_path="${HOME}/.ssh/${key_name:-ltride-key}.pem"
}

prepare_ssh() {
  # Populate the ssh_command array once, after resolving host + key. Every
  # remote call reuses it so host/key resolution happens a single time.
  resolve_ssh_host || return 1
  resolve_ssh_key
  if [ ! -f "$ssh_key_path" ]; then
    echo "SSH key not found: ${ssh_key_path} (set SSH_KEY=/path/to/key.pem)." >&2
    return 1
  fi
  chmod 600 "$ssh_key_path" 2>/dev/null || true
  ssh_command=(ssh -i "$ssh_key_path" -o StrictHostKeyChecking=accept-new "${ssh_user}@${ssh_host}")
  echo "target: ${ssh_user}@${ssh_host} (key: ${ssh_key_path})"
}

remote() { "${ssh_command[@]}" "$@"; }
