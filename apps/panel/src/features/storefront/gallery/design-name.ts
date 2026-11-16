import type { TFunction } from "i18next"
import type { DesignCard, DesignSummary, PresetCard, PresetRef } from "./api"
import { isLook } from "./families"

const G = "storefront.gallery"

// The shop's dates are Turkey's (admin-ui `lib/format.ts`)
const DAY_TIME = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})
const DAY = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Istanbul",
})

/** "17 Kasım 14:20". */
export const dayAndTime = (value: string | Date) => DAY_TIME.format(new Date(value))
/** "17 Kasım". */
export const dayOf = (value: string | Date) => DAY.format(new Date(value))

/** Where a look came from, in words: a ready-made or saved look's name, or the shop's own work. */
export function sourceName(t: TFunction, summary: DesignSummary): string {
  return summary.source !== "own" && summary.source_name ? summary.source_name : t(`${G}.auto.own`)
}

/**
 * A saved look's name as the gallery shows it: its own, or for an
 * automatic save "{kaynak}, {17 Kasım 14:20}" and ", düzenlenmiş" when
 * it had been changed from what it came from (adr/0064 Ek 2026-11-17).
 */
export function designName(
  t: TFunction,
  design: Pick<DesignCard, "name" | "summary" | "created_at">
) {
  if (design.name) {
    return design.name
  }
  const values = { source: sourceName(t, design.summary), date: dayAndTime(design.created_at) }
  return t(design.summary.edited ? `${G}.auto.nameEdited` : `${G}.auto.name`, values)
}

/**
 * What the draft or the live design was last given, in words: a saved
 * look by its name, a ready-made one by its name, else the shop's own.
 */
export function lookName(
  t: TFunction,
  ref: { preset: PresetRef | null; design_id: string | null },
  presets: readonly PresetCard[],
  designs: readonly DesignCard[]
): string {
  const design = ref.design_id ? designs.find((each) => each.id === ref.design_id) : undefined
  if (design) {
    return designName(t, design)
  }
  const preset = ref.preset ? presets.find((each) => isLook(each, ref.preset)) : undefined
  return preset ? preset.name : t(`${G}.auto.own`)
}

/** The name offered for keeping the draft: "{kaynak}, 17 Kasım". */
export const suggestedName = (t: TFunction, source: string, now = new Date()) =>
  t(`${G}.auto.name`, { source, date: dayOf(now) }).slice(0, NAME_MAX)

/** The server's limit on a saved look's name (backend `DESIGN_LIMITS.name`). */
export const NAME_MAX = 60
