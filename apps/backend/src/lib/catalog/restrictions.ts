import type { CategoryPlace } from "./categories"

/**
 * Why a product is sold to adults only (F13.4, adr/0041 §4): the shop
 * marks a product or a category, never the code a sector. Each reason is
 * one of schema.org's adult considerations, which the product's JSON-LD
 * names.
 */
export const RESTRICTIONS = ["weapon", "alcohol", "tobacco", "adult_content", "other"] as const
export type Restriction = (typeof RESTRICTIONS)[number]

export const isRestriction = (value: unknown): value is Restriction =>
  typeof value === "string" && (RESTRICTIONS as readonly string[]).includes(value)

/** schema.org's `AdultOrientedEnumeration` value for each reason. */
export const ADULT_CONSIDERATIONS: Readonly<Record<Restriction, string>> = {
  weapon: "https://schema.org/WeaponConsideration",
  alcohol: "https://schema.org/AlcoholConsideration",
  tobacco: "https://schema.org/TobaccoNicotineConsideration",
  adult_content: "https://schema.org/SexualContentConsideration",
  other: "https://schema.org/UnclassifiedAdultConsideration",
}

/**
 * A product's restriction: its own mark first, else the first marked
 * category it is in or under (a category's mark passes to its children
 * and their products). Null when nothing marks it.
 */
export function restrictionOf(
  own: string | null | undefined,
  categories: readonly (CategoryPlace | null | undefined)[] | null | undefined,
  marked: ReadonlyMap<string, Restriction>
): Restriction | null {
  if (isRestriction(own)) {
    return own
  }
  for (const category of categories ?? []) {
    for (const id of (category?.mpath ?? category?.id ?? "").split(".")) {
      const restriction = marked.get(id)
      if (restriction) {
        return restriction
      }
    }
  }
  return null
}

/**
 * Whole years between a date of birth and today, in Türkiye's time: a
 * birthday counts from its first moment there. Null for a date that is
 * not one, or one in the future.
 */
export function ageOn(birthDate: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) {
    return null
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const born = new Date(Date.UTC(year, month - 1, day))
  if (born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) {
    return null
  }
  const [nowYear, nowMonth, nowDay] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  })
    .format(today)
    .split("-")
    .map(Number) as [number, number, number]
  const age = nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0)
  return age < 0 ? null : age
}
