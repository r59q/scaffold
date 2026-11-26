#!/usr/bin/env bash
set -euo pipefail

die() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

: "${VAULT_ADDR:?Set the VAULT_ADDR repository secret}"
: "${VAULT_USERNAME:?Set the VAULT_USERNAME repository secret}"
: "${VAULT_PASSWORD:?Set the VAULT_PASSWORD repository secret}"
: "${PROD_SSH_KNOWN_HOSTS:?Set the PROD_SSH_KNOWN_HOSTS repository variable}"

umask 077
credentials=$(mktemp -d "${RUNNER_TEMP:-/tmp}/scaffold-demo.XXXXXXXX")
wg_interface=scaffold-ci
wg_config="$credentials/$wg_interface.conf"
tunnel_up=false

cleanup() {
  if [[ "$tunnel_up" == true ]]; then
    if ! sudo wg-quick down "$wg_config" > /dev/null 2>&1; then
      echo '::warning::Could not tear down the WireGuard tunnel.' >&2
    fi
  fi
  rm -rf -- "$credentials"
}
trap cleanup EXIT

username=$(jq -nr 'env.VAULT_USERNAME | @uri')
if ! token=$(
  jq -nc '{password: env.VAULT_PASSWORD}' |
    curl --fail --silent --show-error --max-time 30 \
      --header 'Content-Type: application/json' --data-binary @- \
      "${VAULT_ADDR%/}/v1/auth/userpass/login/$username" |
    jq -er '.auth.client_token | strings | select(length > 0)'
); then
  die 'Vault userpass login failed.'
fi
printf '::add-mask::%s\n' "$token"
unset VAULT_USERNAME VAULT_PASSWORD

if ! scaffold=$(
  printf 'X-Vault-Token: %s\n' "$token" |
    curl --fail --silent --show-error --max-time 30 --header @- \
      "${VAULT_ADDR%/}/v1/kv/data/scaffold" |
    jq -ce '.data.data | objects'
); then
  die 'Could not read kv/scaffold from Vault.'
fi
unset token

prod_field() {
  jq -er --arg key "$1" \
    '(.["prod." + $key] // .prod[$key]) | strings | rtrimstr("\n") | select(length > 0)' <<< "$scaffold" ||
    die "Vault field prod.$1 must be a nonempty string."
}

hostname=$(prod_field hostname)
ssh_username=$(prod_field ssh_username)
wg_ip=$(prod_field wg_ip)
prod_field ssh_private_key > "$credentials/id_deploy"
prod_field wg_config > "$wg_config"
unset scaffold

[[ "$hostname" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || die 'prod.hostname must be a hostname.'
[[ -n "$ssh_username" && "$ssh_username" != *[[:space:]]* ]] || die 'prod.ssh_username must be a username.'
node -e 'process.exit(require("node:net").isIP(process.argv[1]) ? 0 : 1)' "$wg_ip" ||
  die 'prod.wg_ip must be a WireGuard IP address.'
printf '::add-mask::%s\n' "$hostname" "$ssh_username" "$wg_ip"

printf '%s\n' "$PROD_SSH_KNOWN_HOSTS" > "$credentials/known_hosts"
ssh-keygen -F "$hostname" -f "$credentials/known_hosts" > /dev/null ||
  die 'PROD_SSH_KNOWN_HOSTS must contain a host key for prod.hostname.'

sudo wg-quick up "$wg_config" > /dev/null 2>&1 || die 'Could not bring up the WireGuard tunnel.'
tunnel_up=true
if ! ip -j route get "$wg_ip" 2>/dev/null | jq -e --arg dev "$wg_interface" '.[0].dev == $dev' > /dev/null; then
  die 'The WireGuard tunnel does not route to prod.wg_ip.'
fi

remote_deploy=$(cat <<'REMOTE'
set -eu
umask 077
deploy_dir="$HOME/scaffold-demo"
mkdir -p -- "$deploy_dir"
release=$(mktemp -d "$deploy_dir/release.XXXXXXXX")
trap 'rm -rf -- "$release"' EXIT
tar -x -C "$release"
cd "$release"
docker compose up --build --wait --wait-timeout 60
ln -sfnT -- "$release" "$deploy_dir/current"
trap - EXIT
REMOTE
)

git archive HEAD -- .dockerignore compose.yaml backend browser demo |
  ssh -F /dev/null -T -i "$credentials/id_deploy" -l "$ssh_username" \
    -o BatchMode=yes -o ConnectTimeout=20 -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes -o "HostKeyAlias=$hostname" \
    -o "UserKnownHostsFile=$credentials/known_hosts" -o GlobalKnownHostsFile=/dev/null \
    -- "$wg_ip" "$remote_deploy"
