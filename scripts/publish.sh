#!/usr/bin/env bash
# Publishes this package to npm. Used by .github/workflows/publish.yml.
#
#   bash scripts/publish.sh               release: needs RELEASE_TAG=v<version> (or GITHUB_REF_NAME)
#   bash scripts/publish.sh --dry-run     build, pack and show what would be uploaded; no registry writes
#   --skip-check                          do not run `mise run check` first (it already ran)
#
# Release steps: tag must equal the package.json version; full check; pack; skip the upload if this
# exact version is already on the registry (so a re-run only does what is missing); upload; wait
# until the version is resolvable; install it into a clean consumer project and run the smoke test.
#
# Authentication: NODE_AUTH_TOKEN (the NPM_TOKEN secret) through a temporary npmrc that refers to
# the environment variable, so the token never appears on a command line or on disk. Without a
# token, npm trusted publishing (GitHub OIDC, npm >= 11.5.1) is used. Provenance is attached only
# when NPM_PROVENANCE=true (the workflow sets it for public repositories).
set -euo pipefail

DRY_RUN=0
SKIP_CHECK=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-check) SKIP_CHECK=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REGISTRY="https://registry.npmjs.org/"
NAME="$(node -p 'require("./package.json").name')"
VERSION="$(node -p 'require("./package.json").version')"
TAG="${RELEASE_TAG:-${GITHUB_REF_NAME:-}}"

log() { printf '==> %s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

if [[ "$TAG" == v* ]]; then
  [[ "$TAG" == "v$VERSION" ]] || fail "tag $TAG does not match package.json version $VERSION"
  log "tag $TAG matches $NAME@$VERSION"
elif [[ "$DRY_RUN" == 0 ]]; then
  fail "set RELEASE_TAG=v$VERSION (a release needs the version tag)"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# A clean npm config without credentials for every read-only registry call.
: > "$TMP/readonly.npmrc"
chmod 600 "$TMP/readonly.npmrc"

published() {
  local found
  found="$(NPM_CONFIG_USERCONFIG="$TMP/readonly.npmrc" npm view "$NAME@$VERSION" version --registry "$REGISTRY" 2>/dev/null || true)"
  [[ "$found" == "$VERSION" ]]
}

if [[ "$SKIP_CHECK" == 0 ]]; then
  log "mise run check"
  mise run check
fi
[[ -f dist/cli.js && -f dist/catalog.json ]] || npm run build

log "packing"
TARBALL="$TMP/$(npm pack --ignore-scripts --silent --pack-destination "$TMP" | tail -n 1)"
[[ -f "$TARBALL" ]] || fail "npm pack did not produce a tarball"

if [[ "$DRY_RUN" == 1 ]]; then
  log "dry run: npm publish would upload $(basename "$TARBALL")"
  if published; then
    # npm refuses even a dry-run publish of an existing version, so list the packed files instead.
    log "$NAME@$VERSION is already on npm (a release would skip the upload); packed files:"
    tar -tzf "$TARBALL" | sed 's/^/  /'
  else
    NPM_CONFIG_USERCONFIG="$TMP/readonly.npmrc" npm publish "$TARBALL" --dry-run --access public --ignore-scripts --registry "$REGISTRY" 2>&1 | grep -E 'name:|version:|filename:|package size:|unpacked size:|total files:|\+ '
    log "$NAME@$VERSION is not on npm yet (or the registry is unreachable)"
  fi
  exit 0
fi

if published; then
  log "$NAME@$VERSION is already published; skipping the upload"
else
  PUBLISH_ARGS=(--access public --ignore-scripts --registry "$REGISTRY")
  if [[ "${NPM_PROVENANCE:-false}" == "true" ]]; then PUBLISH_ARGS+=(--provenance); else export NPM_CONFIG_PROVENANCE=false; fi
  if [[ -n "${NODE_AUTH_TOKEN:-}" ]]; then
    log "publishing with the npm token"
    # npm expands ${NODE_AUTH_TOKEN} when it reads the file; the token itself is never written.
    printf '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\n' > "$TMP/publish.npmrc"
    chmod 600 "$TMP/publish.npmrc"
    NPM_CONFIG_USERCONFIG="$TMP/publish.npmrc" npm publish "$TARBALL" "${PUBLISH_ARGS[@]}"
  else
    log "no NODE_AUTH_TOKEN: publishing through npm trusted publishing (OIDC)"
    [[ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]] || fail "no token and no GitHub OIDC environment (needs permissions: id-token: write)"
    NPM_CONFIG_USERCONFIG="$TMP/readonly.npmrc" npm publish "$TARBALL" "${PUBLISH_ARGS[@]}"
  fi
fi

log "waiting until $NAME@$VERSION is resolvable"
deadline=$(( $(date +%s) + 900 ))
until published; do
  (( $(date +%s) < deadline )) || fail "$NAME@$VERSION did not become resolvable on $REGISTRY within 15 minutes"
  sleep 10
done

log "installing $NAME@$VERSION into a clean consumer project"
CONSUMER="$TMP/consumer"
mkdir -p "$CONSUMER"
cp scripts/smoke.mjs "$CONSUMER/smoke.mjs"
cat > "$CONSUMER/package.json" <<'JSON'
{ "name": "daapi-release-check", "private": true, "type": "module" }
JSON
(
  cd "$CONSUMER"
  attempts=0
  until NPM_CONFIG_USERCONFIG="$TMP/readonly.npmrc" npm install "$NAME@$VERSION" --registry "$REGISTRY" --no-audit --no-fund --ignore-scripts; do
    attempts=$((attempts + 1))
    (( attempts < 6 )) || fail "could not install $NAME@$VERSION from $REGISTRY"
    sleep 20
  done
  node smoke.mjs --expect-version "$VERSION"
)
log "$NAME@$VERSION is published and verified"
