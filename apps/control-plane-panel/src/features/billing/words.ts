import type { TFunction } from "i18next"
import type { ChargeStatus, SubscriptionStatus } from "@qticaret/types/control-plane"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { Charge, ChargeStanding } from "./api"

/** Kuruş as lira: "1.490,00 ₺". */
export const money = (kurus: number, currency = "TRY") => formatMoney(kurus / 100, currency)

/** A period as its first and last day (its end is the next one's first). */
export function periodText(start: string, end: string): string {
  const last = new Date(Date.parse(`${end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  return `${formatDate(start)} – ${formatDate(last)}`
}

export const SUBSCRIPTION_TONES: Record<SubscriptionStatus, StatusTone> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  restricted: "danger",
  cancelled: "neutral",
}

const STANDING_TONES: Record<ChargeStanding, StatusTone> = {
  upcoming: "info",
  past_due: "warning",
  overdue: "danger",
}

const SETTLED_TONES: Record<Exclude<ChargeStatus, "open">, StatusTone> = {
  paid: "success",
  waived: "neutral",
  void: "neutral",
}

/** A charge's word and tone: where an open one stands, else how it was settled. */
export function chargeWord(
  t: TFunction,
  charge: Pick<Charge, "status" | "standing">
): { label: string; tone: StatusTone } {
  if (charge.status === "open") {
    const standing = charge.standing ?? "upcoming"
    return { label: t(`billing.standing.${standing}`), tone: STANDING_TONES[standing] }
  }
  return { label: t(`billing.chargeStatus.${charge.status}`), tone: SETTLED_TONES[charge.status] }
}
