import { z } from "zod"
import { dayEnd, dayOf, dayStart } from "@qticaret/admin-ui/lib/days"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { scheduleOf } from "@/features/promotions/offer"
import type { PriceList } from "./api/price-lists"

/** Medusa's price list rule for customer groups: the list prices only their members. */
export const GROUPS_RULE = "customer.groups.id"

/** The price list form (F4.1); messages are i18n keys. Dates are whole Istanbul days. */
export const priceListSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: "priceLists.errors.title" })
      .max(100, { message: "priceLists.errors.title" }),
    description: z.string().trim().max(500, { message: "priceLists.errors.description" }),
    type: z.enum(["sale", "override"]),
    active: z.boolean(),
    starts: z.string(),
    ends: z.string(),
    audience: z.enum(["everyone", "groups"]),
    groups: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.starts && values.ends && values.ends < values.starts) {
      ctx.addIssue({ code: "custom", path: ["ends"], message: "priceLists.errors.dates" })
    }
    if (values.audience === "groups" && values.groups.length === 0) {
      ctx.addIssue({ code: "custom", path: ["groups"], message: "priceLists.errors.groups" })
    }
  })

export type PriceListValues = z.infer<typeof priceListSchema>

const groupsOf = (list: PriceList | null): string[] => {
  const rule: unknown = (list?.rules as Record<string, unknown> | null | undefined)?.[GROUPS_RULE]
  return Array.isArray(rule) ? rule.filter((id): id is string => typeof id === "string") : []
}

export function valuesOf(list: PriceList | null): PriceListValues {
  const groups = groupsOf(list)
  return {
    title: list?.title ?? "",
    description: list?.description ?? "",
    type: list?.type === "override" ? "override" : "sale",
    active: list ? list.status === "active" : true,
    starts: dayOf(list?.starts_at),
    ends: dayOf(list?.ends_at),
    audience: groups.length > 0 ? "groups" : "everyone",
    groups,
  }
}

// Rules the form does not show (a region, say, set elsewhere): kept as they are
const otherRules = (list: PriceList | null): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries((list?.rules as Record<string, unknown> | null | undefined) ?? {}).flatMap(
      ([attribute, value]) =>
        attribute !== GROUPS_RULE && Array.isArray(value)
          ? [[attribute, value.filter((each): each is string => typeof each === "string")]]
          : []
    )
  )

/**
 * The body Medusa takes to make or change a list; everyone means no group
 * rule, and other rules stay as set. A saved list is turned on and off
 * from its page's header, so its form leaves the status alone, and its
 * days only when they were changed: a time set elsewhere (12:00, say)
 * would otherwise move to the day's end.
 */
export function bodyOf(
  values: PriceListValues,
  existing: PriceList | null = null,
  datesChanged = true
) {
  const isNew = existing === null
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    type: values.type,
    ...(isNew ? { status: values.active ? ("active" as const) : ("draft" as const) } : {}),
    ...(isNew || datesChanged
      ? {
          starts_at: dayStart(values.starts)?.toISOString() ?? null,
          ends_at: dayEnd(values.ends)?.toISOString() ?? null,
        }
      : {}),
    rules: {
      ...otherRules(existing),
      ...(values.audience === "groups" ? { [GROUPS_RULE]: values.groups } : {}),
    },
  }
}

/** How far a list price is below the variant's own, in whole percent; null when not below. */
export function percentOff(base: string | null, price: string): number | null {
  const own = Number(base)
  const listed = Number(price)
  if (!base || !(own > 0) || !(listed < own)) {
    return null
  }
  return Math.round((1 - listed / own) * 100)
}

/** A percentage the server takes ("12,5"): above zero, at most 99, to two decimals. */
export function percentOf(text: string): number | null {
  const percent = parseMoneyInput(text)
  return percent !== null && percent > 0 && percent <= 99 ? percent : null
}

/** Where a list stands today: on, waiting for its first day, over, or a draft. */
export const listSchedule = (list: Pick<PriceList, "status" | "starts_at" | "ends_at">) =>
  scheduleOf(list.status, list)
