#!/usr/bin/env node
// Checks a branch before its PR into `dev` (GitHub Actions is off; CLAUDE.md
// "Ortak çalışma"): typecheck, lint and unit tests of every package the
// branch changed and every package that depends on one, then prettier on the
// changed files. Integration tests (backend, control plane HTTP) are not run
// here; the PR says when they were needed and run by hand.
//
//   pnpm verify:changed            # against origin/dev
//   pnpm verify:changed origin/main
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"

const base = process.argv[2] ?? "origin/dev"
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts })
const read = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" })

const remote = base.includes("/") ? base.slice(0, base.indexOf("/")) : null
if (remote) {
  run("git", ["fetch", "--quiet", remote, base.slice(remote.length + 1)])
}

const changed = read("git", ["diff", "--name-only", "--diff-filter=d", `${base}...HEAD`])
  .split("\n")
  .concat(read("git", ["diff", "--name-only", "--diff-filter=d", "HEAD"]).split("\n"))
  .concat(read("git", ["ls-files", "--others", "--exclude-standard"]).split("\n"))
  .filter((file) => file && existsSync(file))
const files = [...new Set(changed)]
if (files.length === 0) {
  console.log(`No change against ${base}.`)
  process.exit(0)
}

console.log(`== typecheck, lint, test (packages changed against ${base} and their dependents)`)
run("pnpm", ["turbo", "run", "typecheck", "lint", "test", `--filter=...[${base}]`])

console.log("== prettier (changed files)")
run("pnpm", ["prettier", "--check", "--ignore-unknown", ...files])

console.log(`\nOK: ${files.length} changed file(s) checked against ${base}.`)
