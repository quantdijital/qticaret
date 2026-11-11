import { MedusaError } from "@medusajs/framework/utils"
import type { EnvelopeContext } from "@qticaret/server-kit"

/**
 * Who a secret belongs to and what it is called (adr/0061 §2, §4.1): the
 * platform's own (`platform`) or a shop's (its `ten_…` id). Names are
 * short, lower-case identifiers; a value never appears in either.
 */

export const PLATFORM_OWNER = "platform"

const OWNER = /^(?:platform|ten_[0-9A-Za-z]{1,40})$/
const NAME = /^[a-z][a-z0-9_.:-]{0,99}$/

export function assertSecretAddress(owner: string, name: string): void {
  if (!OWNER.test(owner) || !NAME.test(name)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.secret_address")
  }
}

/**
 * The associated data a secret is sealed under (adr/0061 §4.1): its owner,
 * name and version, so a sealed value copied to another row, another
 * owner or another version opens nowhere.
 */
export const secretContext = (owner: string, name: string, version: number): EnvelopeContext => ({
  table: "secret_record",
  owner,
  name,
  version,
})
