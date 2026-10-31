#!/usr/bin/env bash
# Dependency report (F15.9, docs/04): known advisories by severity, each
# with its package and fix, then outdated direct dependencies. Reads the
# lockfile and the registry; changes nothing. Exits 1 on a critical
# advisory, as CI's audit does (.github/workflows/security.yml).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
report="$(mktemp)"
trap 'rm -f "$report"' EXIT

echo "== Advisories (pnpm audit) =="
# Non-zero whenever any advisory is found; the counts below decide
pnpm audit --json > "$report" || true
audit_status=0
node - "$report" <<'NODE' || audit_status=$?
const fs = require("node:fs")
const audit = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
const counts = audit.metadata?.vulnerabilities ?? {}
const order = ["critical", "high", "moderate", "low", "info"]
console.log(order.map((level) => `${level}: ${counts[level] ?? 0}`).join("  "))
const advisories = Object.values(audit.advisories ?? {}).sort(
  (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
)
for (const advisory of advisories) {
  const fix = advisory.patched_versions ? `fixed in ${advisory.patched_versions}` : "no fix yet"
  console.log(`- [${advisory.severity}] ${advisory.module_name}: ${advisory.title} (${fix})`)
  console.log(`  ${advisory.url}`)
}
if ((counts.critical ?? 0) > 0) {
  process.exitCode = 1
}
NODE

echo
echo "== Outdated direct dependencies (pnpm outdated) =="
# Exits 1 when anything is outdated: a report, not a failure
pnpm outdated --recursive || true

exit "$audit_status"
