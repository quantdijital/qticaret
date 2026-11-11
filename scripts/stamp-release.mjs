// Stamps what a compiled backend is (adr/0061 §5.4, Ek C13): writes
// `.medusa/server/release.json` with the app's package.json version and the
// commit it was built from, which the shop's hourly usage report carries.
// Run by `pnpm --filter backend build` after `medusa build`, from the app's
// folder. No shell: git is run directly. Without a readable commit (no git,
// an archive) the file is removed and the shop reports what it can find
// at run time (apps/backend/src/lib/control-plane/release.ts).
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const app = process.cwd()
const server = join(app, ".medusa", "server")
const target = join(server, "release.json")
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/
const COMMIT = /^[0-9a-f]{7,40}$/

function commit() {
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: app,
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim()
    return COMMIT.test(out) ? out : null
  } catch {
    return null
  }
}

if (!existsSync(server)) {
  console.error("stamp-release: no compiled server (.medusa/server); run medusa build first")
  process.exit(1)
}
const { version } = JSON.parse(readFileSync(join(app, "package.json"), "utf8"))
const hash = commit()
if (!SEMVER.test(String(version)) || hash === null) {
  rmSync(target, { force: true })
  console.warn("stamp-release: version or commit unknown; no release.json written")
} else {
  writeFileSync(target, `${JSON.stringify({ version, commit: hash })}\n`)
  console.log(`stamp-release: ${version} ${hash.slice(0, 12)}`)
}
