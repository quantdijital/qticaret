import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../security/text"
import { ADDONS_MAX, ADDON_LABEL_MAX, AddonsInput, storedAddonsOf } from "./schema"
import type { StoredAddon } from "./schema"

/**
 * Add-on templates (adr/0052 Ek 2026-11-23): add-ons defined once and
 * linked to many products, live. A product's add-ons as a shopper sees
 * and the cart prices them are its effective ones: its own first, then
 * the templates its attribute template carries (in that template's
 * order), then the templates linked to it directly (by name). A template
 * reached twice counts once; five add-ons in all at most (`ADDONS_MAX`).
 * Pure, so tested on its own.
 */

/** A template's name: as an add-on's label, a plain line. */
export const AddonTemplateName = z
  .string()
  .trim()
  .refine((name) => name.length >= 1 && name.length <= ADDON_LABEL_MAX && isCleanText(name), {
    message: "addon_templates.name_invalid",
  })

/**
 * A template's add-ons: as a product's. None is allowed: the panel makes a
 * template by its name first and fills it on its own page.
 */
export const AddonTemplateAddons = AddonsInput

/** Ids of add-on templates as a write names them: each once, few enough to matter. */
export const AddonTemplateIds = z
  .array(z.string().min(1).max(64))
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, { message: "addon_templates.duplicate" })

/** A template as the effective add-ons read it. */
export interface AddonTemplateSource {
  id: string
  name: string
  addons: StoredAddon[]
}

/** How a product reaches a template: linked to it, or through its attribute template. */
export type AddonTemplateVia = "product" | "attribute_template"

/** What a product's add-ons are made of, before they are merged. */
export interface AddonSources {
  own: readonly StoredAddon[]
  /** Carried by the product's attribute template, in that template's order. */
  carried: readonly AddonTemplateSource[]
  /** Linked to the product itself. */
  linked: readonly AddonTemplateSource[]
}

export interface EffectiveAddons {
  /** What the shopper picks from and the cart prices, in order; five at most. */
  addons: StoredAddon[]
  /** The templates in play, each once, with how the product reaches it. */
  templates: (AddonTemplateSource & { via: AddonTemplateVia })[]
  /** Add-ons left out past the limit (a template grew after it was linked). */
  hidden: number
}

/** A template row as stored, read as a source; its add-ons from the `{ items }` column. */
export const templateSourceOf = (row: {
  id: string
  name: string
  addons?: unknown
}): AddonTemplateSource => ({
  id: row.id,
  name: row.name,
  addons: storedAddonsOf(row.addons ?? null),
})

/** Templates linked directly, in the order they show: by name, then id. */
export const byTemplateName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  a.name.localeCompare(b.name, "tr") || a.id.localeCompare(b.id)

/**
 * A product's add-ons merged: its own, then carried, then linked; an
 * add-on id seen already is left out (one template reached twice), and
 * past five the rest are hidden: the writes refuse that, this keeps the
 * storefront's limit when a product changes attribute template.
 */
export function effectiveAddons(sources: AddonSources): EffectiveAddons {
  const templates: EffectiveAddons["templates"] = []
  const seenTemplates = new Set<string>()
  for (const [via, list] of [
    ["attribute_template", sources.carried],
    ["product", sources.linked],
  ] as const) {
    for (const template of list) {
      if (!seenTemplates.has(template.id)) {
        seenTemplates.add(template.id)
        templates.push({ ...template, via })
      }
    }
  }
  const all: StoredAddon[] = []
  const seen = new Set<string>()
  for (const addon of [...sources.own, ...templates.flatMap((template) => template.addons)]) {
    if (!seen.has(addon.id)) {
      seen.add(addon.id)
      all.push(addon)
    }
  }
  return {
    addons: all.slice(0, ADDONS_MAX),
    templates,
    hidden: Math.max(0, all.length - ADDONS_MAX),
  }
}

/** How many add-ons the product would have, past the limit or not. */
export const addonCount = (sources: AddonSources): number => {
  const merged = effectiveAddons(sources)
  return merged.addons.length + merged.hidden
}

/** Whether these sources stay within the limit. */
export const withinAddonLimit = (sources: AddonSources): boolean =>
  addonCount(sources) <= ADDONS_MAX

/**
 * Whether a change takes a product past five add-ons, counted merged
 * (duplicates once) before and after: one already past five may still
 * shrink or stay as it is.
 */
export const growsPastLimit = (before: AddonSources, after: AddonSources): boolean =>
  !withinAddonLimit(after) && addonCount(after) > addonCount(before)

/**
 * Whether a template's save names an add-on or a choice it does not have:
 * new ones come without an id (the server gives it), so a stranger id is
 * refused rather than taken (adr/0052 Ek 2026-11-23).
 */
export function hasForeignIds(
  inputs: readonly {
    id?: string | undefined
    kind: string
    choices?: { id?: string | undefined }[]
  }[],
  existing: readonly StoredAddon[]
): boolean {
  const known = new Map(existing.map((addon) => [addon.id, addon]))
  return inputs.some((input) => {
    if (input.id === undefined) {
      return (input.choices ?? []).some((choice) => choice.id !== undefined)
    }
    const stored = known.get(input.id)
    if (!stored) {
      return true
    }
    const choices = new Set(
      stored.kind === "choice" ? stored.choices.map((choice) => choice.id) : []
    )
    return (input.choices ?? []).some(
      (choice) => choice.id !== undefined && !choices.has(choice.id)
    )
  })
}
