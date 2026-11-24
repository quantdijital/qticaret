#!/usr/bin/env bash
# What a CI run needs to check (2026-11-24): a branch that touches only the
# storefront, the panel or the theme packages does not need the backend's
# integration shards, which fill the account's runners for 40-60 minutes.
#
# Writes to $GITHUB_OUTPUT:
#   backend=true|false  - the integration shards (HTTP 1-12, modules)
#   e2e=true|false      - the panel's e2e (a real backend serving the panel)
#   filter=<turbo args> - lint, typecheck and test only for the changed
#                         packages and those that depend on them; empty = all
#
# Everything runs in full on dev and main, on a manual run, and whenever a
# file outside the workspaces' own folders changed (the lockfile, the CI,
# turbo or the root package.json): such a change can reach every package.
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
full() {
  echo "backend=true" >>"$out"
  echo "e2e=true" >>"$out"
  echo "filter=" >>"$out"
  echo "ci-changes: full run ($1)"
  exit 0
}

ref="${GITHUB_REF_NAME:-}"
event="${GITHUB_EVENT_NAME:-push}"
[ "$ref" = "dev" ] || [ "$ref" = "main" ] && full "branch $ref"
[ "$event" = "workflow_dispatch" ] && full "manual run"

# The checkout fetched every branch (fetch-depth: 0) without keeping credentials
git rev-parse --verify --quiet origin/dev >/dev/null || full "dev not fetched"
base="$(git merge-base HEAD origin/dev)" || full "no merge base with dev"
files="$(git diff --name-only "$base" HEAD)"
[ -z "$files" ] && full "no changed files"

# Files that never change what a test sees
quiet='^(progress/|docs/|adr/)|\.md$'
# Folders whose packages the backend does not depend on
front='^(apps/storefront/|apps/panel/|packages/ui/|packages/themes/|packages/admin-ui/)'
# ...and of those, the ones the panel's e2e does not run
storefront_only='^(apps/storefront/|packages/ui/|packages/themes/)'

relevant="$(grep -Ev "$quiet" <<<"$files" || true)"
[ -z "$relevant" ] && full "only notes changed"
if grep -Ev '^(apps|packages)/' <<<"$relevant" >/dev/null; then
  full "a file outside the workspaces changed"
fi

backend=false
grep -Ev "$front" <<<"$relevant" >/dev/null && backend=true
e2e=false
grep -Ev "$storefront_only" <<<"$relevant" >/dev/null && e2e=true

{
  echo "backend=$backend"
  echo "e2e=$e2e"
  echo "filter=--filter=...[$base]"
} >>"$out"
echo "ci-changes: backend=$backend e2e=$e2e, packages changed since $base and their dependents"
