import type { ContractedReturnCodes } from "../../modules/platform-settings/sections"
import { isSuspended } from "../integrations/suspended"
import { CARRIER_NAMES, carrierNameOf } from "./carriers"
import type { CarrierName } from "./carriers"
import {
  ARAS_FULFILLMENT_PROVIDER_ID,
  DHL_ECOMMERCE_FULFILLMENT_PROVIDER_ID,
  SURAT_FULFILLMENT_PROVIDER_ID,
  YURTICI_FULFILLMENT_PROVIDER_ID,
} from "./carriers"

/** The code a shopper says at the carrier's branch, and that carrier as they read it. */
export interface ContractedReturn {
  carrier: string
  code: string
}

const PROVIDER_OF: Readonly<Record<CarrierName, string>> = {
  aras: ARAS_FULFILLMENT_PROVIDER_ID,
  yurtici: YURTICI_FULFILLMENT_PROVIDER_ID,
  dhlecommerce: DHL_ECOMMERCE_FULFILLMENT_PROVIDER_ID,
  surat: SURAT_FULFILLMENT_PROVIDER_ID,
}

/**
 * The contracted return code an approved return shows (adr/0031 Ek
 * 2026-11-26). While BirFatura's cargo module manages the parcels, the
 * carrier and code the shop named for it. Otherwise one of our carriers'
 * codes: that of the carrier behind the shop's main shipping option
 * (Settings > Shipping's "Kargo ücreti") when it has one, else the first
 * with a code, Aras, then Yurtiçi, then DHL eCommerce, then Sürat. Any of them takes a
 * parcel at any of its branches whichever way the order left, so one shop-wide pick does.
 * A carrier suspended on this server (`lib/integrations/suspended.ts`) is
 * passed over: its code, entered before, is not shown.
 * Null: no code entered for the way the shop ships; the shopper is told
 * the shop will be in touch, as before.
 */
export function contractedReturnOf(input: {
  codes: ContractedReturnCodes
  birfatura: boolean
  primaryCarrier: CarrierName | null
}): ContractedReturn | null {
  const { codes } = input
  if (input.birfatura) {
    return codes.other_carrier && codes.other_code
      ? { carrier: codes.other_carrier, code: codes.other_code }
      : null
  }
  const order: CarrierName[] = (
    input.primaryCarrier
      ? [input.primaryCarrier, ...CARRIER_NAMES.filter((each) => each !== input.primaryCarrier)]
      : [...CARRIER_NAMES]
  ).filter((each) => !isSuspended(each))
  const carrier = order.find((each) => codes[each])
  const code = carrier ? codes[carrier] : null
  return carrier && code ? { carrier: carrierNameOf(PROVIDER_OF[carrier]) ?? carrier, code } : null
}

/**
 * The code a request shows (store route, admin, the approval e-mail): one
 * the carrier made for it (a Geliver return, kept on old requests) as it
 * is, without a name; else, while it is approved and the parcel is still
 * to send, the shop's contracted code. Read when shown, so a code the
 * shop changes reaches requests approved before. A cancelled, refused or
 * finished request shows none.
 */
export function requestReturnCode(
  request: { status: string; return_code?: string | null | undefined },
  contracted: ContractedReturn | null
): { return_code: string | null; return_carrier: string | null } {
  if (request.status === "canceled") {
    return { return_code: null, return_carrier: null }
  }
  if (request.return_code) {
    return { return_code: request.return_code, return_carrier: null }
  }
  if (request.status === "approved" && contracted) {
    return { return_code: contracted.code, return_carrier: contracted.carrier }
  }
  return { return_code: null, return_carrier: null }
}
