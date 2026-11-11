import { createLocalKeyWrapper, kekFingerprint, parseKekList } from "@qticaret/server-kit"
import type { KeyWrapper } from "@qticaret/server-kit"

/**
 * The control plane's key-encryption keys (adr/0061 §4.1, Ek C8):
 * `CP_MASTER_KEY`, one or more 64-hex keys, newest first. New records are
 * wrapped with the first; any listed key still opens what it wrapped, so a
 * rotation is: put the new key first, rewrap (`cp:keys rewrap` or the
 * panel), then drop the old key once nothing is left under it.
 *
 * Read from the process environment and rebuilt only when the value
 * changes (the boot's schema check has already validated it); the keys
 * stay in this process's memory, never in a log, an error or a row.
 */

interface MasterKeys {
  raw: string
  wrapper: KeyWrapper
  /** Fingerprints, current first. */
  ids: string[]
}

let cached: MasterKeys | undefined

function masterKeys(): MasterKeys {
  const raw = process.env["CP_MASTER_KEY"] ?? ""
  if (cached?.raw !== raw) {
    const keks = parseKekList(raw, "CP_MASTER_KEY")
    cached = { raw, wrapper: createLocalKeyWrapper(keks), ids: keks.map(kekFingerprint) }
    // The wrapper keeps its own copies
    for (const kek of keks) {
      kek.fill(0)
    }
  }
  return cached
}

export const masterKeyWrapper = (): KeyWrapper => masterKeys().wrapper

/** The configured KEKs' fingerprints, the current one first. */
export const configuredKekIds = (): readonly string[] => masterKeys().ids
