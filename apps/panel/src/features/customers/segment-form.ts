import type { TFunction } from "i18next"
import type { CustomerSegment, SegmentRules } from "@/features/customers/api/groups"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { parseCountInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

export type Tristate = "any" | "yes" | "no"

/** The segment form as typed: text fields and three-way choices. */
export interface SegmentDraft {
  name: string
  minSpent: string
  minOrders: string
  withinDays: string
  lapsedDays: string
  registered: Tristate
  consent: Tristate
}

const text = (value: number | undefined): string => (value === undefined ? "" : String(value))
const tristate = (value: boolean | undefined): Tristate =>
  value === undefined ? "any" : value ? "yes" : "no"

/** The form for a segment, or an empty one. */
export function draftOf(segment?: CustomerSegment): SegmentDraft {
  const rules = segment?.rules ?? {}
  return {
    name: segment?.name ?? "",
    minSpent: rules.min_total_spent === undefined ? "" : String(rules.min_total_spent / 100),
    minOrders: text(rules.min_orders),
    withinDays: text(rules.ordered_within_days),
    lapsedDays: text(rules.not_ordered_for_days),
    registered: tristate(rules.registered),
    consent: tristate(rules.email_consent),
  }
}

export type DraftField = "name" | "minSpent" | "minOrders" | "withinDays" | "lapsedDays" | "rules"

/**
 * The rules the form says, money in kuruş; or the first field that is
 * wrong (the key of its message). An empty field is no rule; at least one
 * rule is needed.
 */
export function rulesOf(
  draft: SegmentDraft
): { name: string; rules: SegmentRules } | { field: DraftField; error: string } {
  const name = draft.name.trim()
  if (name === "") {
    return { field: "name", error: "customers.segments.errors.name" }
  }
  const rules: SegmentRules = {}
  if (draft.minSpent.trim() !== "") {
    const lira = parseMoneyInput(draft.minSpent)
    if (lira === null || lira <= 0) {
      return { field: "minSpent", error: "customers.segments.errors.money" }
    }
    rules.min_total_spent = Math.round(lira * 100)
  }
  const counts = [
    ["minOrders", "min_orders"],
    ["withinDays", "ordered_within_days"],
    ["lapsedDays", "not_ordered_for_days"],
  ] as const
  for (const [field, rule] of counts) {
    if (draft[field].trim() !== "") {
      const count = parseCountInput(draft[field])
      if (count === null || count <= 0) {
        return { field, error: "customers.segments.errors.count" }
      }
      rules[rule] = count
    }
  }
  if (draft.registered !== "any") {
    rules.registered = draft.registered === "yes"
  }
  if (draft.consent !== "any") {
    rules.email_consent = draft.consent === "yes"
  }
  return Object.keys(rules).length === 0
    ? { field: "rules", error: "customers.segments.errors.rules" }
    : { name, rules }
}

const S = "customers.segments"

/** The rules in a line: "en az 3 sipariş · üye". */
export function rulesText(t: TFunction, rules: SegmentRules): string {
  const parts: string[] = []
  if (rules.min_total_spent !== undefined) {
    parts.push(
      t(`${S}.rules.minSpent`, { amount: formatMoney(rules.min_total_spent / 100, "try") })
    )
  }
  if (rules.min_orders !== undefined) {
    parts.push(t(`${S}.rules.minOrders`, { count: rules.min_orders }))
  }
  if (rules.ordered_within_days !== undefined) {
    parts.push(t(`${S}.rules.withinDays`, { count: rules.ordered_within_days }))
  }
  if (rules.not_ordered_for_days !== undefined) {
    parts.push(t(`${S}.rules.lapsedDays`, { count: rules.not_ordered_for_days }))
  }
  if (rules.registered !== undefined) {
    parts.push(t(rules.registered ? `${S}.rules.registered` : `${S}.rules.guest`))
  }
  if (rules.email_consent !== undefined) {
    parts.push(t(rules.email_consent ? `${S}.rules.consent` : `${S}.rules.noConsent`))
  }
  return parts.join(" · ")
}
