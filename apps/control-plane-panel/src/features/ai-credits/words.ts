import type { TFunction } from "i18next"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import type { Me } from "@/features/auth/api"
import { displayName } from "@/features/auth/api"

/**
 * The AI credits in this panel's words (adr/0085): counts the Turkish way
 * ("1.250 kredi"), the ledger's kinds and buckets, who wrote a row.
 */

export const credits = (t: TFunction, value: number) =>
  t("aiCredits.credits", { count: value, value: formatCount(value) })

/** A ledger row's move with its sign: "+500", "−20". */
export const signed = (value: number) =>
  value > 0 ? `+${formatCount(value)}` : `−${formatCount(Math.abs(value))}`

const KINDS = [
  "grant_purchase",
  "grant_plan_monthly",
  "spend",
  "release",
  "expire",
  "adjust",
] as const

/** A ledger kind in words; one this panel does not know yet by its name. */
export const kindText = (t: TFunction, kind: string) =>
  (KINDS as readonly string[]).includes(kind) ? t(`aiCredits.ledger.kinds.${kind}`) : kind

/** The month a grant is for ("2026-11" → "Kasım 2026"). */
export function monthText(period: string): string {
  const at = new Date(`${period}-01T12:00:00Z`)
  return Number.isNaN(at.getTime())
    ? period
    : at.toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
}

/** Who wrote a row: the system, you, or a staff member's id (the ledger keeps no name). */
export function actorText(t: TFunction, actor: string, me: Me | undefined): string {
  if (actor === "system") {
    return t("aiCredits.ledger.system")
  }
  if (me?.id === actor) {
    return t("aiCredits.ledger.you", { name: displayName(me) })
  }
  return actor
}
