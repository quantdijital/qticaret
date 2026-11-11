import { randomBytes } from "node:crypto"
import { constants } from "node:fs"
import { chmod, lstat, mkdir, open, rename, rm } from "node:fs/promises"
import { dirname } from "node:path"
import { ProvisioningError } from "../provisioner"

/**
 * A local shop's private files (Ek C10, review L5): its env file, pid file
 * and logs. Written whole through a fresh 0600 temporary file in its 0700
 * folder and renamed into place; read through a handle opened without
 * following a link, and checked on that handle (a plain file, ours, no one
 * else's to read or change), in a folder no one else may enter.
 */

const NO_FOLLOW = constants.O_NOFOLLOW

/** The folder of a private file: made 0700 if missing, refused when it is a link or open to others. */
export async function privateFolder(path: string, make: boolean): Promise<void> {
  const folder = dirname(path)
  if (make) {
    await mkdir(folder, { recursive: true, mode: 0o700 })
  }
  const stats = await lstat(folder)
  const uid = process.getuid?.()
  if (!stats.isDirectory() || (uid !== undefined && stats.uid !== uid)) {
    throw new ProvisioningError("provisioning.secrets_exposed")
  }
  if ((stats.mode & 0o077) !== 0) {
    if (!make) {
      throw new ProvisioningError("provisioning.secrets_exposed")
    }
    await chmod(folder, 0o700)
  }
}

/** `text` at `path`, whole or not at all, 0600. */
export async function writePrivateFile(path: string, text: string): Promise<void> {
  await privateFolder(path, true)
  const temporary = `${path}.${randomBytes(6).toString("hex")}.tmp`
  const handle = await open(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW,
    0o600
  )
  try {
    await handle.writeFile(text, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

/** The file's text, or null when there is none; refused unless it is private (see above). */
export async function readPrivateFile(path: string): Promise<string | null> {
  try {
    await lstat(path)
  } catch {
    return null
  }
  await privateFolder(path, false)
  let handle
  try {
    handle = await open(path, constants.O_RDONLY | NO_FOLLOW)
  } catch {
    // A link (ELOOP) or a file that went away between the two looks
    throw new ProvisioningError("provisioning.secrets_exposed")
  }
  try {
    const stats = await handle.stat()
    const uid = process.getuid?.()
    if (!stats.isFile() || (stats.mode & 0o077) !== 0 || (uid !== undefined && stats.uid !== uid)) {
      throw new ProvisioningError("provisioning.secrets_exposed")
    }
    return await handle.readFile("utf8")
  } finally {
    await handle.close()
  }
}

/** Logs are capped (review L8): past `max` bytes the file moves to `<name>.1`, the older one dropped. */
export const LOG_MAX_BYTES = 5 * 1024 * 1024

export async function rotateLog(path: string, max: number = LOG_MAX_BYTES): Promise<void> {
  const stats = await lstat(path).catch(() => null)
  if (stats?.isFile() && stats.size > max) {
    await rename(path, `${path}.1`)
  }
}

/** A log opened to append (0600, not through a link), rotated first. */
export async function openLog(path: string) {
  await privateFolder(path, true)
  await rotateLog(path)
  return await open(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | NO_FOLLOW,
    0o600
  )
}
