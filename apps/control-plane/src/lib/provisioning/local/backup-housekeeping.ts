import { constants } from "node:fs"
import { open, readFile, readdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProvisioningError } from "../provisioner"

/**
 * The local backups' housekeeping (audit 3.2, security review L1, L2, L4):
 * one backup at a time, a crash's leftovers removed, the last few kept.
 */

/** Backups kept per shop: older ones are removed after a backup succeeds. */
export const BACKUPS_KEPT = 7
/** The per-run `.pgpass` folders' prefix in the system's temporary folder. */
export const PASS_DIR_PREFIX = "qticaret-pgpass-"
// Longer than any backup runs (its limit is an hour)
const STALE_PASS_DIR_MS = 2 * 60 * 60 * 1000

/**
 * The per-run `.pgpass` folders a crash left behind (review L1): older
 * than a backup can run, ours, in the system's temporary folder. Swept
 * when the local provisioner is made (the control plane's start) and
 * before each backup.
 */
export async function sweepStalePassDirs(root: string = tmpdir()): Promise<void> {
  const names = await readdir(root).catch(() => [] as string[])
  for (const name of names.filter((each) => each.startsWith(PASS_DIR_PREFIX))) {
    const path = join(root, name)
    const stats = await stat(path).catch(() => null)
    if (stats?.isDirectory() && Date.now() - stats.mtimeMs > STALE_PASS_DIR_MS) {
      await rm(path, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

/**
 * One backup at a time on this machine, whichever shop (review L2): a lock
 * file holding the process id in the backups' folder. One left by a
 * process that is gone is taken over.
 */
export async function takeLock(path: string): Promise<() => Promise<void>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(
        path,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
        0o600
      )
      await handle.writeFile(String(process.pid))
      await handle.close()
      return async () => {
        await rm(path, { force: true })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error
      }
      const pid = Number((await readFile(path, "utf8").catch(() => "")).trim())
      let alive = false
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0)
          alive = true
        } catch {
          alive = false
        }
      }
      if (alive) {
        throw new ProvisioningError("provisioning.backup_busy")
      }
      await rm(path, { force: true })
    }
  }
  throw new ProvisioningError("provisioning.backup_busy")
}

/** The database's backups in its folder, newest first, by their manifests. */
export async function manifestsOf(outDir: string, database: string): Promise<string[]> {
  const names = await readdir(outDir).catch(() => [] as string[])
  return names
    .filter((name) => name.startsWith(`${database}-`) && name.endsWith(".manifest.json"))
    .sort()
    .reverse()
}

/** What a crash left half written (review L4): `.part` files, never a whole backup. */
export async function pruneParts(outDir: string): Promise<void> {
  const names = await readdir(outDir).catch(() => [] as string[])
  for (const name of names.filter((each) => each.endsWith(".part"))) {
    await rm(join(outDir, name), { force: true })
  }
}

/** All but the newest `BACKUPS_KEPT` of the database's backups removed (review L2). */
export async function pruneOld(outDir: string, database: string): Promise<void> {
  for (const manifest of (await manifestsOf(outDir, database)).slice(BACKUPS_KEPT)) {
    const base = manifest.slice(0, -".manifest.json".length)
    for (const end of [".dump.age", ".files.tar.age", ".manifest.json"]) {
      await rm(join(outDir, `${base}${end}`), { force: true })
    }
  }
}
