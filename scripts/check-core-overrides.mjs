#!/usr/bin/env node
// Checks our Turkish overrides of core admin texts (adr/0021) against a
// Medusa dashboard translation: every overridden key must still exist and
// keep the same {{placeholders}}. Run it on every Medusa upgrade:
//
//   gh api -H "Accept: application/vnd.github.raw" \
//     "repos/medusajs/medusa/contents/packages/admin/dashboard/src/i18n/translations/tr.json?ref=v<VERSION>" \
//     > /tmp/core-tr.json
//   node scripts/check-core-overrides.mjs /tmp/core-tr.json
import { readFileSync } from "node:fs"

const OVERRIDES = new URL("../apps/backend/src/admin/i18n/core-overrides/tr.json", import.meta.url)
// i18next interpolations ({{x}}, {{- x}}, {{x, format}}), nesting ($t(key))
// and Trans tags (<0>, </0>)
const PLACEHOLDER = /\{\{[^}]+\}\}|\$t\([^)]*\)|<\/?\d+>/g

function* leaves(node, prefix = "") {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object") {
      yield* leaves(value, path)
    } else {
      yield [path, value]
    }
  }
}

const corePath = process.argv[2]
if (!corePath) {
  console.error("usage: node scripts/check-core-overrides.mjs <dashboard tr.json>")
  process.exit(2)
}
const core = new Map(leaves(JSON.parse(readFileSync(corePath, "utf8"))))
const placeholders = (text) =>
  [...String(text).matchAll(PLACEHOLDER)]
    .map((m) => m[0])
    .sort()
    .join()
const problems = []
for (const [key, text] of leaves(JSON.parse(readFileSync(OVERRIDES, "utf8")))) {
  if (!core.has(key)) {
    problems.push(`gone from core: ${key}`)
  } else if (placeholders(core.get(key)) !== placeholders(text)) {
    problems.push(`placeholders differ: ${key}`)
  }
}
if (problems.length > 0) {
  console.error(problems.join("\n"))
  process.exit(1)
}
console.log(`ok: ${core.size} core keys, every override still matches`)
