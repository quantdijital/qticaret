import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isLocalEnv } from "@qticaret/server-kit"
import { usageReportSchema } from "@qticaret/types/control-plane"
import type { UsageReport } from "@qticaret/types/control-plane"

export type Release = UsageReport["release"]

/** Said when the commit cannot be known: seven zeros, never a real-looking one. */
export const UNKNOWN_COMMIT = "0000000"
/** The file `pnpm build` writes beside the compiled server (scripts/stamp-release.mjs). */
export const RELEASE_FILE = "release.json"

const releaseSchema = usageReportSchema.shape.release
const COMMIT = /^[0-9a-f]{7,40}$/

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

function versionIn(cwd: string): string | null {
  const parsed = readJson(join(cwd, "package.json"))
  const version = (parsed as { version?: unknown } | null)?.version
  return releaseSchema.shape.version.safeParse(version).success ? (version as string) : null
}

function gitCommit(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim()
    return COMMIT.test(out) ? out : null
  } catch {
    return null
  }
}

/**
 * What this shop runs (adr/0061 §5.4, Ek C13): semver and commit.
 *
 * 1. `release.json` in the working folder: stamped at build time beside the
 *    compiled server (`.medusa/server`; a local shop links to it)
 * 2. else the working folder's `package.json` version, with the commit from
 *    `RELEASE` when it is a commit (CI sets it so), else, on a developer's
 *    machine only, `git rev-parse HEAD` (no shell, two seconds)
 * 3. else the version with `0000000`: unknown, and `known` false says so
 */
export function readRelease(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
): Release & { known: boolean } {
  const stamped = releaseSchema.safeParse(readJson(join(cwd, RELEASE_FILE)))
  if (stamped.success) {
    return { ...stamped.data, known: true }
  }
  const version = versionIn(cwd) ?? "0.0.0"
  const fromEnv = env["RELEASE"]?.trim().toLowerCase()
  const commit =
    fromEnv && COMMIT.test(fromEnv)
      ? fromEnv
      : isLocalEnv({ NODE_ENV: env["NODE_ENV"] })
        ? gitCommit(cwd)
        : null
  return { version, commit: commit ?? UNKNOWN_COMMIT, known: commit !== null }
}

let cached: (Release & { known: boolean }) | undefined

/** `readRelease` once per process: the code a process runs does not change under it. */
export function runningRelease(): Release & { known: boolean } {
  cached ??= readRelease()
  return cached
}
