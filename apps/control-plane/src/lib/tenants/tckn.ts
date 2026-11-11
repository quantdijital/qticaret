import {
  createLocalKeyWrapper,
  maskTaxId,
  openEnvelopeText,
  parseEnvelope,
  parseKekList,
  sealEnvelope,
  serializeEnvelope,
} from "@qticaret/server-kit"
import type { KeyWrapper } from "@qticaret/server-kit"
import { parseEnv } from "../env"

/**
 * A sole proprietor's TCKN at rest (adr/0061 §2, §4.1): sealed with
 * envelope encryption under the control plane's local KEK
 * (`CP_MASTER_KEY`), bound to the shop it belongs to, so a sealed value
 * copied to another shop's row opens nowhere. Only its last four digits are
 * kept in the clear, for the mask.
 */

let wrapper: KeyWrapper | undefined

function keyWrapper(): KeyWrapper {
  wrapper ??= createLocalKeyWrapper(parseKekList(parseEnv().CP_MASTER_KEY, "CP_MASTER_KEY"))
  return wrapper
}

const contextOf = (tenantId: string) => ({
  table: "tenant_company",
  field: "tckn",
  tenant_id: tenantId,
})

export interface SealedTckn {
  tckn_sealed: string
  tckn_last4: string
}

export async function sealTckn(tenantId: string, tckn: string): Promise<SealedTckn> {
  const envelope = await sealEnvelope(tckn, contextOf(tenantId), keyWrapper())
  return { tckn_sealed: serializeEnvelope(envelope), tckn_last4: tckn.slice(-4) }
}

export async function openTckn(tenantId: string, sealed: string): Promise<string> {
  return openEnvelopeText(parseEnvelope(sealed), contextOf(tenantId), keyWrapper())
}

/** `*******1234`, or null when none is kept. */
export const maskedTckn = (last4: string | null | undefined): string | null =>
  last4 ? maskTaxId("tckn", last4) : null
