import type { TFunction } from "i18next"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import type { Me } from "@/features/auth/api"
import { displayName } from "@/features/auth/api"
import type { AiOrder } from "@/features/ai-credits/api/schemas"

/**
 * The AI credits in this panel's words (adr/0085): counts the Turkish way
 * ("1.250 kredi"), the ledger's kinds and buckets, who wrote a row.
 */

export const credits = (t: TFunction, value: number) =>
  t("aiCredits.credits", { count: value, value: formatCount(value) })

/** A request's shop by its name; by its id when the answer names none. */
export const shopName = (order: AiOrder) => order.tenant?.name ?? order.tenant_id

/** Where the shop is found: its primary address, else its slug; null when unnamed. */
export const shopPlace = (order: AiOrder) =>
  order.tenant?.primary_hostname ?? order.tenant?.slug ?? null

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

/**
 * Who wrote a row: the system, you, or a staff member by the name the
 * answer gives (`actor_name`, P3d). A staff id with no name is a member
 * since removed (or a control plane before P3d): said neutrally, the id
 * kept as a quiet second line (`id`). Any other actor is shown as it is.
 */
export function actorOf(
  t: TFunction,
  row: { actor: string; actor_name?: string | null | undefined },
  me: Me | undefined
): { text: string; id?: string } {
  if (row.actor === "system") {
    return { text: t("aiCredits.ledger.system") }
  }
  if (me?.id === row.actor) {
    return { text: t("aiCredits.ledger.you", { name: displayName(me) }) }
  }
  if (row.actor_name) {
    return { text: row.actor_name }
  }
  if (row.actor.startsWith("user_")) {
    return { text: t("aiCredits.ledger.unnamed"), id: row.actor }
  }
  return { text: row.actor }
}

const SERVICES = ["deepseek", "minimax", "qwen", "gemini", "photoroom", "bria", "fake"] as const

/** A service by its name ("Google Gemini"); one this panel does not know yet by its id. */
export const serviceName = (t: TFunction, service: string) =>
  (SERVICES as readonly string[]).includes(service) ? t(`aiCredits.services.${service}`) : service

/** A capability in words ("Metin yazma"). */
export const capabilityName = (t: TFunction, capability: string) =>
  t(`aiCredits.capabilities.${capability}`, { defaultValue: capability })
