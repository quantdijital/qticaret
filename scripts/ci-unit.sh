#!/usr/bin/env bash
# Usage: ci-unit.sh <group>   (TURBO_FILTER: the changed packages' filter, or empty)
# Runs one group's unit tests, side by side with the other groups' jobs
# (adr/0081): the backend, the panel, the storefront, and the rest. Of the
# group only the packages the push can reach run (scripts/ci-changes.sh).
set -euo pipefail

# "backend 2/3": the backend's tests are many (760 files, one at a time for
# the Redis they share), so they are cut into shards, a job each
group="${1%% *}"
shard=""
[ "$1" != "$group" ] && shard="${1#* }"
filter="${TURBO_FILTER:-}"

# shellcheck disable=SC2086
all="$(pnpm --silent turbo run test $filter --dry=json | node -e '
  let text = ""
  process.stdin.on("data", (chunk) => (text += chunk))
  process.stdin.on("end", () => {
    const plan = JSON.parse(text)
    const names = plan.tasks.filter((task) => task.task === "test" && task.command !== "<NONEXISTENT>")
    console.log(names.map((task) => task.package).join("\n"))
  })
')"

in_group() {
  case "$group" in
    backend) [ "$1" = "@qticaret/backend" ] ;;
    panel) [ "$1" = "@qticaret/panel" ] ;;
    storefront) [ "$1" = "@qticaret/storefront" ] ;;
    packages)
      [ "$1" != "@qticaret/backend" ] && [ "$1" != "@qticaret/panel" ] && [ "$1" != "@qticaret/storefront" ]
      ;;
    *)
      echo "ci-unit: unknown group $group" >&2
      exit 2
      ;;
  esac
}

args=()
while IFS= read -r package; do
  [ -z "$package" ] && continue
  if in_group "$package"; then
    args+=("--filter=$package")
  fi
done <<<"$all"

if [ "${#args[@]}" -eq 0 ]; then
  echo "ci-unit: nothing of '$group' is touched by this push"
  exit 0
fi
echo "ci-unit: $group${shard:+ (shard $shard)} -> ${args[*]}"
# One package's tests at a time: side by side they starved the UI suites
# past their per-test timeout on a four-core runner
#
# A full run (dev, main, by hand: no filter) runs every test afresh. Some
# tests read another package's files without depending on it (the backend's
# reserved storefront routes, the panel's copy of the feature list), so
# turbo's cache, which knows a package by its own files, would replay their
# last green over a change it cannot see. A branch's run keeps the cache.
[ -z "$filter" ] && args+=("--force")
if [ -n "$shard" ]; then
  pnpm turbo run test --continue --concurrency=1 "${args[@]}" -- "--shard=$shard"
else
  pnpm turbo run test --continue --concurrency=1 "${args[@]}"
fi
