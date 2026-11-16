import { mkdtemp, open, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SIGNATURE_BYTES } from "./limits"

/** A fresh private directory for one upload's file (mkdtemp makes it 0700). */
export const makeVideoTempDir = (root: string = tmpdir()): Promise<string> =>
  mkdtemp(join(root, "qt-video-"))

/** Removes an upload's directory and what is in it; never throws. */
export async function removeVideoTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true })
  } catch {
    // Already gone, or the next start's tmp cleaning takes it
  }
}

/** The first bytes of a received file, enough to tell what it is. */
export async function readHead(
  path: string,
  length: number = SIGNATURE_BYTES
): Promise<Uint8Array> {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
