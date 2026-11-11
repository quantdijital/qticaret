import { parseEnvelope, rewrapEnvelope, serializeEnvelope } from "@qticaret/server-kit"
import type { EnvelopeContext } from "@qticaret/server-kit"
import { configuredKekIds, masterKeyWrapper } from "./keks"

/**
 * KEK rotation (adr/0061 §4.1, Ek C8): every sealed value whose data key is
 * still wrapped under an older configured KEK gets it wrapped under the
 * current one. The data is never decrypted, only its data key is; the
 * ciphertext stays as it is. Each row is swapped only if it is still what
 * was read (compare-and-swap), so two runs, or a run and a new write, never
 * lose one. Safe to stop and run again: what is left is what a query finds.
 */

export interface SealedRow {
  id: string
  sealed: string
  /** The associated data it was sealed under. */
  context: EnvelopeContext
}

export interface RewrapTally {
  rewrapped: number
  /** Could not be rewrapped (a damaged or misplaced value): left as it is. */
  failed: number
  /** Ids of the failed rows, for the log (never a value). */
  failed_ids: string[]
}

export const emptyTally = (): RewrapTally => ({ rewrapped: 0, failed: 0, failed_ids: [] })

/** The configured KEKs that are not the current one: what a rewrap moves away from. */
export function olderKekIds(): string[] {
  const [, ...older] = configuredKekIds()
  return older
}

/** The KEK id a serialised envelope names; null when it is not one. */
export function kekOf(sealed: string): string | null {
  try {
    return parseEnvelope(sealed).kekId
  } catch {
    return null
  }
}

/**
 * Rewraps `rows` under the current KEK through `swap(id, from, to, kekId)`,
 * which writes only if the row still holds `from`. Rows already current, or
 * under a KEK this process does not hold, are left alone.
 */
export async function rewrapRows(
  rows: readonly SealedRow[],
  swap: (id: string, from: string, to: string, kekId: string) => Promise<boolean>,
  tally: RewrapTally = emptyTally()
): Promise<RewrapTally> {
  const wrapper = masterKeyWrapper()
  for (const row of rows) {
    const kekId = kekOf(row.sealed)
    if (kekId === null || kekId === wrapper.kekId || !wrapper.canUnwrap(kekId)) {
      continue
    }
    try {
      const { envelope } = await rewrapEnvelope(parseEnvelope(row.sealed), row.context, wrapper)
      if (await swap(row.id, row.sealed, serializeEnvelope(envelope), envelope.kekId)) {
        tally.rewrapped += 1
      }
    } catch {
      tally.failed += 1
      tally.failed_ids.push(row.id)
    }
  }
  return tally
}
