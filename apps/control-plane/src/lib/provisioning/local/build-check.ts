import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { ProvisioningError } from "../provisioner"

/**
 * Whether what a local shop runs was built from the sources as they are
 * (C10 review, build safety): every build exists and is no older than the
 * newest file it was built from. Tests do not count (they are not built
 * into what runs). A stale build is refused (`provisioning.build_stale`),
 * a missing one too (`provisioning.backend_not_built`): run
 * `pnpm turbo run build --filter=@qticaret/backend` first.
 */

const SKIPPED = new Set(["__tests__", "testing", "node_modules"])
const isTest = (name: string) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(name)

/** The newest modification time under `dir`, tests left out; 0 for an empty tree. */
export async function newestSource(dir: string): Promise<number> {
  let newest = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name) || entry.name.startsWith(".")) {
      continue
    }
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      newest = Math.max(newest, await newestSource(path))
    } else if (entry.isFile() && !isTest(entry.name)) {
      newest = Math.max(newest, (await stat(path)).mtimeMs)
    }
  }
  return newest
}

export async function assertFreshBuilds(
  builds: readonly { source: string; built: string }[]
): Promise<void> {
  for (const { source, built } of builds) {
    const made = await stat(built).catch(() => null)
    if (!made) {
      throw new ProvisioningError("provisioning.backend_not_built")
    }
    if ((await newestSource(source)) > made.mtimeMs) {
      throw new ProvisioningError("provisioning.build_stale")
    }
  }
}
