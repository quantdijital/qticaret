import { readFileSync } from "node:fs"
import { join } from "node:path"
import { RELEASE_VERSION } from "./releases"

/**
 * The control plane's own version (audit 3.1): its working folder's
 * `package.json` (in development the app's, once built the copy beside
 * the compiled server), as a shop reads its own. Null when it cannot be
 * read or is not strict semver: then no shop is moved ahead of it.
 */
export function controlPlaneVersion(cwd: string = process.cwd()): string | null {
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      version?: unknown
    }
    return typeof parsed.version === "string" && RELEASE_VERSION.test(parsed.version)
      ? parsed.version
      : null
  } catch {
    return null
  }
}
