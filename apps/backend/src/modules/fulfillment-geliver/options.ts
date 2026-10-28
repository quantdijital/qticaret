import type { QuoteChoice } from "../../lib/shipping/geliver"

/**
 * The ways a Geliver shipping option picks its carrier service (adr/0031):
 * the cheapest offer, the fastest, or one service by its code when the
 * option's data names it (`service_code`, set with the option). The table
 * option is priced by the shop's own table (F7.8) and ships with the
 * cheapest offer. Names are Medusa's own admin's; the panel words them
 * from the id.
 */
export const GELIVER_OPTIONS = [
  { id: "geliver-cheapest", name: "Geliver: cheapest offer" },
  { id: "geliver-fastest", name: "Geliver: fastest offer" },
  { id: "geliver-table", name: "Geliver: the shop's price table" },
] as const

export type GeliverOptionId = (typeof GELIVER_OPTIONS)[number]["id"]

export const isGeliverOption = (id: unknown): id is GeliverOptionId =>
  GELIVER_OPTIONS.some((option) => option.id === id)

/** The choice an option's (or a shipping method's) data makes. */
export function choiceOf(data: Record<string, unknown> | undefined): QuoteChoice {
  const code = data?.["service_code"]
  if (typeof code === "string" && /^[A-Z0-9_]{2,64}$/.test(code)) {
    return { by: "service", code }
  }
  return (data?.["option"] ?? data?.["id"]) === "geliver-fastest"
    ? { by: "fastest" }
    : { by: "cheapest" }
}
