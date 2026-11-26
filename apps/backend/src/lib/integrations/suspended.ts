import { parseEnv } from "../env"
import type { Env } from "../env"
import { CARRIER_NAMES, carrierOf } from "../shipping/carriers"
import type { CarrierName } from "../shipping/carriers"

/**
 * Carriers built and tested but suspended on the platform (adr/0027 Ek
 * 2026-11-26 "askı"; the owner, 2026-11-26: "DHL gizli kalsın, platformda
 * altyapıda durabilir"). Each has one server switch, off unless set to
 * "true": off, no shop sees it (Ayarlar > Kargo, Entegrasyonlar, the
 * option editor, the board's filter, the footer marks, the return code
 * picker), its account routes answer 404, its options are not offered at
 * checkout and it opens no parcel. The code and its tests stay; the test
 * run turns the switch on (`integration-tests/setup.js`).
 *
 * A server switch rather than a platform flag (adr/0012): a suspension is
 * the platform's decision for every shop, not a plan's; a platform flag
 * is listed on the shop's Özellikler page, which would name the carrier;
 * and the call sites that judge it are synchronous.
 */
const SWITCHES: Readonly<Partial<Record<CarrierName, keyof Env>>> = {
  dhlecommerce: "CARRIER_DHLECOMMERCE_ENABLED",
}

/** The carriers suspended on this server now. */
export function suspendedCarriers(env: Env = parseEnv()): CarrierName[] {
  return CARRIER_NAMES.filter((name) => {
    const key = SWITCHES[name]
    return key !== undefined && env[key] !== "true"
  })
}

/** Whether a carrier (or an integration provider of that name) is suspended here. */
export const isSuspended = (name: string | null | undefined, env?: Env): boolean =>
  (suspendedCarriers(env) as string[]).includes(name ?? "")

/** Whether a fulfillment provider belongs to a suspended carrier. */
export const isSuspendedProvider = (providerId: string | null | undefined, env?: Env): boolean =>
  isSuspended(carrierOf(providerId), env)

/** The carriers a shop on this server is offered, in their usual order. */
export function offeredCarriers(env: Env = parseEnv()): CarrierName[] {
  const suspended = suspendedCarriers(env)
  return CARRIER_NAMES.filter((name) => !suspended.includes(name))
}
