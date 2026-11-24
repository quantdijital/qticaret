#!/usr/bin/env bash
# What a CI run needs to check (adr/0081). A branch runs what its changes can
# reach; dev and main run everything.
#
# Writes to $GITHUB_OUTPUT:
#   code=true|false     - anything but notes changed (false: every job skips)
#   backend=true|false  - the backend's integration suites
#   e2e=true|false      - the panel's e2e (a real backend serving the panel)
#   filter=<turbo args> - lint, typecheck and unit tests only for the changed
#                         packages and those that depend on them; empty = all
#
# Everything runs on dev and main, on a manual run, and whenever a file
# outside the workspaces' own folders changed (the lockfile, the CI, turbo or
# the root package.json): such a change can reach every package.
#
# The checkout has the whole history (fetch-depth: 0). CI_LAST_GREEN is the
# head of the branch's last green run, asked of the API on dev and main.
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
answer() {
  {
    echo "code=$1"
    echo "backend=$2"
    echo "e2e=$3"
    echo "filter=$4"
  } >>"$out"
  echo "ci-changes: code=$1 backend=$2 e2e=$3 filter='$4' ($5)"
  exit 0
}
full() { answer true true true "" "$1"; }

# A rename is a removal and an addition: a backend file moved under docs/ or
# into the storefront still counts as a backend change (its old path is listed)
changed() { git diff --name-only --no-renames "$1" HEAD; }

# Files that never change what a check sees
quiet='^(progress/|docs/|adr/)|\.md$'
# Folders whose packages the backend does not depend on (its integration
# suites cannot see a change there)
no_backend='^(apps/storefront/|apps/panel/|apps/control-plane/|apps/control-plane-panel/|packages/ui/|packages/themes/|packages/admin-ui/)'
# ...and of those, the ones the panel's e2e does not run either
no_e2e='^(apps/storefront/|apps/control-plane/|apps/control-plane-panel/|packages/ui/|packages/themes/)'

ref="${GITHUB_REF_NAME:-}"
event="${GITHUB_EVENT_NAME:-push}"
[ "$event" = "workflow_dispatch" ] && full "manual run"

if [ "$ref" = "dev" ] || [ "$ref" = "main" ]; then
  # Skipped only when nothing but notes came since the last GREEN run, not
  # since the last push: a notes push that cancels a code push's run in
  # progress must not stand in for it (the next run still sees that code)
  green="${CI_LAST_GREEN:-}"
  if [ -n "$green" ] && git cat-file -e "$green^{commit}" 2>/dev/null &&
    git merge-base --is-ancestor "$green" HEAD; then
    since="$(changed "$green")"
    if [ -n "$since" ] && ! grep -Ev "$quiet" <<<"$since" >/dev/null; then
      answer false false false "" "only notes on $ref since its last green run ${green:0:9}"
    fi
  fi
  full "branch $ref"
fi

git rev-parse --verify --quiet origin/dev >/dev/null || full "dev not fetched"
base="$(git merge-base HEAD origin/dev)" || full "no merge base with dev"
files="$(changed "$base")"
[ -z "$files" ] && full "no changed files"

relevant="$(grep -Ev "$quiet" <<<"$files" || true)"
[ -z "$relevant" ] && answer false false false "" "only notes changed"
if grep -Ev '^(apps|packages)/' <<<"$relevant" >/dev/null; then
  full "a file outside the workspaces changed"
fi

backend=false
grep -Ev "$no_backend" <<<"$relevant" >/dev/null && backend=true
e2e=false
grep -Ev "$no_e2e" <<<"$relevant" >/dev/null && e2e=true

answer true "$backend" "$e2e" "--filter=...[$base]" "packages changed since ${base:0:9} and their dependents"
