import type { MedusaContainer } from "@medusajs/framework/types"
import { tenantsIn, vaultIn } from "../../workflows/modules"
import { configuredKekIds } from "./keks"

type Container = Pick<MedusaContainer, "resolve">

/**
 * - `current`: new values are wrapped with it
 * - `older`: still configured; what is under it opens, a rewrap moves it
 * - `missing`: not configured: what is under it cannot be opened until the
 *   key is put back in `CP_MASTER_KEY` (it was removed before its rewrap)
 */
export type KekState = "current" | "older" | "missing"

export interface KekRow {
  /** The key's fingerprint (`kekFingerprint`), never the key. */
  kek_id: string
  state: KekState
  records: { secret_record: number; tenant_company: number }
  total: number
}

export interface KekStatus {
  keks: KekRow[]
  /** Values under an older configured KEK: a rewrap moves them. */
  pending: number
  /** Values under a KEK that is not configured: unreadable until it is back. */
  stranded: number
  /** Older keys with nothing left under them: safe to remove from `CP_MASTER_KEY`. */
  removable: string[]
}

/**
 * Where every sealed value stands (adr/0061 §4.1, Ek C8): per KEK, how many
 * secrets and TCKNs it holds and whether it is configured. Counts and
 * fingerprints only.
 */
export async function kekStatus(container: Container): Promise<KekStatus> {
  const [secrets, tckns] = await Promise.all([
    vaultIn(container).secretCountsByKek(),
    tenantsIn(container).tcknCountsByKek(),
  ])
  const configured = configuredKekIds()
  const ids = [...new Set([...configured, ...secrets.keys(), ...tckns.keys()])]
  const keks = ids.map((kekId): KekRow => {
    const records = {
      secret_record: secrets.get(kekId) ?? 0,
      tenant_company: tckns.get(kekId) ?? 0,
    }
    const position = configured.indexOf(kekId)
    return {
      kek_id: kekId,
      state: position === 0 ? "current" : position > 0 ? "older" : "missing",
      records,
      total: records.secret_record + records.tenant_company,
    }
  })
  const sum = (state: KekState) =>
    keks.filter((row) => row.state === state).reduce((total, row) => total + row.total, 0)
  return {
    keks,
    pending: sum("older"),
    stranded: sum("missing"),
    removable: keks
      .filter((row) => row.state === "older" && row.total === 0)
      .map((row) => row.kek_id),
  }
}
