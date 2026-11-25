#!/usr/bin/env node
// Which unit test jobs a push needs (adr/0081), as the JSON list the `unit`
// matrix of ci.yml opens: the groups of scripts/ci-unit.sh that hold a
// package with tests among the changed workspaces and those depending on
// them (what turbo's --filter=...[base] runs). Plain Node, no install: it
// runs in the `changes` job, before anything is installed.
//
//   ci-unit-groups.mjs --all          every group (dev, main, a full run)
//   git diff --name-only ... | ci-unit-groups.mjs   the groups those files reach
//   git diff --name-only ... | ci-unit-groups.mjs --reaches <package>
//                                     true if those files reach that package
//                                     (it or a workspace it depends on changed)
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// The order of the jobs. The backend's tests ran as three shards while they
// ran in one process; with three jest workers a job (ci-unit.sh) one job
// holds them in about the time a shard took (adr/0081 Ek 2026-11-25).
// "backend 1/2", "backend 2/2" here cuts them again (ci-unit.sh reads it)
const GROUPS = ["backend", "panel", "storefront", "packages"]
const OWN_GROUP = {
  "@qticaret/backend": "backend",
  "@qticaret/panel": "panel",
  "@qticaret/storefront": "storefront",
}
// pnpm-workspace.yaml's folders
const WORKSPACE_PARENTS = ["apps", "packages", "packages/themes"]
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]

export function readWorkspaces(root) {
  const workspaces = []
  for (const parent of WORKSPACE_PARENTS) {
    const dir = join(root, parent)
    if (!existsSync(dir)) {
      continue
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const manifest = join(dir, entry.name, "package.json")
      if (entry.isDirectory() && existsSync(manifest)) {
        const json = JSON.parse(readFileSync(manifest, "utf8"))
        workspaces.push({
          dir: `${parent}/${entry.name}/`,
          name: json.name,
          tested: Boolean(json.scripts?.test),
          uses: DEPENDENCY_FIELDS.flatMap((field) => Object.keys(json[field] ?? {})),
        })
      }
    }
  }
  return workspaces
}

/** The workspaces `files` change, and every workspace depending on those. */
export function reachedWorkspaces(workspaces, files) {
  // A file belongs to the workspace with the longest folder holding it
  const owner = (file) =>
    workspaces
      .filter((workspace) => file.startsWith(workspace.dir))
      .sort((a, b) => b.dir.length - a.dir.length)[0]
  const reached = new Set(
    files
      .map(owner)
      .filter(Boolean)
      .map((workspace) => workspace.name)
  )
  let grew = true
  while (grew) {
    grew = false
    for (const workspace of workspaces) {
      if (!reached.has(workspace.name) && workspace.uses.some((name) => reached.has(name))) {
        reached.add(workspace.name)
        grew = true
      }
    }
  }
  return reached
}

/** The groups `files` reach through `workspaces`, in job order. */
export function unitGroups(workspaces, files) {
  const reached = reachedWorkspaces(workspaces, files)
  const groups = new Set(
    workspaces
      .filter((workspace) => workspace.tested && reached.has(workspace.name))
      .map((workspace) => OWN_GROUP[workspace.name] ?? "packages")
  )
  return GROUPS.filter((group) => groups.has(group.split(" ")[0]))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--all") {
    process.stdout.write(`${JSON.stringify(GROUPS)}\n`)
  } else if (process.argv[2] === "--reaches") {
    const files = readFileSync(0, "utf8").split("\n").filter(Boolean)
    const reached = reachedWorkspaces(readWorkspaces(process.cwd()), files)
    process.stdout.write(`${String(reached.has(process.argv[3]))}\n`)
  } else {
    const files = readFileSync(0, "utf8").split("\n").filter(Boolean)
    const groups = unitGroups(readWorkspaces(process.cwd()), files)
    process.stdout.write(`${JSON.stringify(groups)}\n`)
  }
}
