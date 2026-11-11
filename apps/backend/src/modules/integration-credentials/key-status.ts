import type { CredentialKeyring } from "../../lib/integrations/credential-keys"

/**
 * Where the shop's sealed accounts stand per key (adr/0061 Ek C17), for
 * `credentials:keys status`, the rewrap job and the runbook (docs/08):
 *
 * - `current`: envelopes under the KEK new records are wrapped with
 * - `older`: envelopes under a configured older KEK; a rewrap moves them
 * - `legacy`: rows still in adr/0027's format under a configured key; read
 *   and upgraded as they are read, or by the rewrap
 * - `missing`: under a key that is not configured: unreadable until it is
 *   put back (after the current one) and the rows are rewrapped
 *
 * Counts and fingerprints only: never a key, never a value.
 */
export type CredentialKeyState = "current" | "older" | "legacy" | "missing"

export interface CredentialKeyRow {
  /** The KEK id (`kekFingerprint`); for a missing old-format key, the row's `key_id`. */
  kek_id: string
  state: CredentialKeyState
  records: number
}

export interface CredentialKeyStatus {
  /** Whether any key is configured at all. */
  configured: boolean
  /** The configured KEK ids, the current first. */
  kek_ids: string[]
  keys: CredentialKeyRow[]
  /** Rows a rewrap still has to move (`older` and `legacy`). */
  pending: number
  /** Rows under a key that is not configured (`missing`). */
  stranded: number
  /** Configured older keys holding nothing: safe to remove from `CREDENTIALS_ENCRYPTION_KEYS`. */
  removable: string[]
}

/** One group of rows as the status query counts them. */
export interface KeyCount {
  key_id: string
  envelope: boolean
  records: number
}

export function keyStatusOf(
  keyring: CredentialKeyring | null,
  counts: readonly KeyCount[]
): CredentialKeyStatus {
  const kekIds = keyring ? [...keyring.kekIds] : []
  const tally = new Map<string, CredentialKeyRow>()
  const add = (kekId: string, state: CredentialKeyState, records: number) => {
    const key = `${kekId}:${state}`
    const row = tally.get(key) ?? { kek_id: kekId, state, records: 0 }
    row.records += records
    tally.set(key, row)
  }
  for (const [index, kekId] of kekIds.entries()) {
    add(kekId, index === 0 ? "current" : "older", 0)
  }
  for (const count of counts) {
    if (count.envelope) {
      const index = kekIds.indexOf(count.key_id)
      add(count.key_id, index === 0 ? "current" : index > 0 ? "older" : "missing", count.records)
      continue
    }
    const legacy = keyring?.legacy.get(count.key_id)
    add(legacy ? legacy.kekId : count.key_id, legacy ? "legacy" : "missing", count.records)
  }
  const keys = [...tally.values()].filter((row) => row.records > 0 || row.state !== "legacy")
  const sum = (...states: CredentialKeyState[]) =>
    keys.filter((row) => states.includes(row.state)).reduce((total, row) => total + row.records, 0)
  const holding = new Set(keys.filter((row) => row.records > 0).map((row) => row.kek_id))
  return {
    configured: kekIds.length > 0,
    kek_ids: kekIds,
    keys,
    pending: sum("older", "legacy"),
    stranded: sum("missing"),
    removable: kekIds.slice(1).filter((kekId) => !holding.has(kekId)),
  }
}
