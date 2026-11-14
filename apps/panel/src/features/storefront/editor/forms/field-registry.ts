import { MARQUEE_SETTINGS, SECTION_VARIANTS } from "@qticaret/types"
import type { MarqueeSetting, SectionLookField } from "@qticaret/types"
import type { AnySection, LayoutGroup, LookedSection } from "@/features/storefront/api/layout"
import { lookFieldsFor, lookStepsFor } from "@/features/storefront/layout/look"
import { isBodyGroup } from "@/features/storefront/layout/sections"
import { isMain } from "@/features/storefront/layout/main-sections"
import { offersVariants } from "@/features/storefront/layout/variants"

/**
 * The section panel's fields as the settings search knows them (adr/0049
 * Ek 2026-11-14 §6): one register built from what the forms are built
 * from, never a second list. The "Biçim" choice reads the type's variants
 * (`SECTION_VARIANTS`, as `VariantField`), the look's fields what the type
 * offers (`lookFieldsFor`, as `LookFields`), the place and the schedule
 * the panel's own groups; the forms take their elements' ids from here,
 * so a search lands on the field it names.
 */

/** The panel group a field sits in: a field in a closed group opens it. */
export type FieldGroupName = "variant" | "placement" | "content" | "look" | "visibility"

export interface RegistryField {
  /** The field's name in the search: `variant`, `look.ground`, `starts_at`. */
  key: string
  group: FieldGroupName
  /** Its everyday name's i18n key. */
  label: string
  /** The technical term's i18n key, shown small beside it ("margin"); null: none. */
  term: string | null
  /** Its choices' names (i18n keys): "Koyu" finds the ground, "Çizgili" the variant. */
  options: readonly string[]
  /** The element the search scrolls to and marks. */
  target: string
}

const P = "storefront.editor.panel"
const LOOK = "storefront.editor.look"
const MARQUEE = "storefront.editor.marquee"

/** A strip's size sits in its content (it is what the strip is); how it moves and looks, with the look. */
const MARQUEE_GROUPS: Readonly<Record<MarqueeSetting, FieldGroupName>> = {
  size: "content",
  ground: "look",
  speed: "look",
  direction: "look",
  separator: "look",
}

const settingsIn = (group: FieldGroupName): readonly MarqueeSetting[] =>
  (Object.keys(MARQUEE_SETTINGS) as MarqueeSetting[]).filter(
    (setting) => MARQUEE_GROUPS[setting] === group
  )

/** A strip's settings in its content: the size. */
export const MARQUEE_CONTENT_SETTINGS = settingsIn("content")

/** How it moves and looks, in the closed "Görünüm ayarları" group with the look's fields. */
export const MARQUEE_LOOK_SETTINGS = settingsIn("look")

/** The elements' ids, shared by the forms and the search. */
export const FIELD_IDS = {
  variant: (sectionId: string) => `${sectionId}-variant`,
  placement: (sectionId: string) => `${sectionId}-placement`,
  look: (sectionId: string, field: SectionLookField) => `${sectionId}-look-${field}`,
  marquee: (sectionId: string, setting: MarqueeSetting) => `${sectionId}-marquee-${setting}`,
  sticky: (sectionId: string) => `${sectionId}-sticky`,
  visible: (sectionId: string) => `${sectionId}-schedule-visible`,
  starts: (sectionId: string) => `${sectionId}-schedule-starts`,
  ends: (sectionId: string) => `${sectionId}-schedule-ends`,
} as const

/**
 * Whether the section takes a look: a page's body section or its main one
 * (not the header's or the footer's parts).
 */
export const takesLook = (section: AnySection, group: LayoutGroup): section is LookedSection =>
  isBodyGroup(group) && section.type !== "announcement_bar"

/** The fields the section's panel shows, in its order, as the search finds them. */
export function sectionFields(section: AnySection, group: LayoutGroup): RegistryField[] {
  const id = section.id
  const fields: RegistryField[] = []
  if (offersVariants(section)) {
    const variants: readonly string[] = SECTION_VARIANTS[section.type]
    fields.push({
      key: "variant",
      group: "variant",
      label: `${P}.variant`,
      term: null,
      options: variants.map((variant) => `storefront.editor.variants.${section.type}.${variant}`),
      target: FIELD_IDS.variant(id),
    })
  }
  if ("placement" in section) {
    fields.push({
      key: "placement",
      group: "placement",
      label: `${P}.placement`,
      term: null,
      options: ["top", "bottom"].map((place) => `storefront.editor.tree.placements.${place}`),
      target: FIELD_IDS.placement(id),
    })
  }
  if (section.type === "marquee") {
    for (const [setting, steps] of Object.entries(MARQUEE_SETTINGS) as [
      MarqueeSetting,
      readonly string[],
    ][]) {
      fields.push({
        key: `marquee.${setting}`,
        group: MARQUEE_GROUPS[setting],
        label: `${MARQUEE}.${setting}.label`,
        term: `${MARQUEE}.${setting}.term`,
        options: steps.map((step) => `${MARQUEE}.${setting}.${step}`),
        target: FIELD_IDS.marquee(id, setting),
      })
    }
  }
  if (section.type === "header_bar") {
    fields.push({
      key: "sticky",
      group: "content",
      label: "storefront.editor.headerBar.sticky",
      term: "storefront.editor.headerBar.stickyTerm",
      options: [],
      target: FIELD_IDS.sticky(id),
    })
  }
  if (takesLook(section, group)) {
    for (const field of lookFieldsFor(section.type)) {
      const steps: readonly string[] = lookStepsFor(section.type, field)
      fields.push({
        key: `look.${field}`,
        group: "look",
        label: `${LOOK}.${field}.label`,
        term: `${LOOK}.${field}.term`,
        options: steps.map((step) => `${LOOK}.${field}.${step}`),
        target: FIELD_IDS.look(id, field),
      })
    }
  }
  // A main section always shows (adr/0049 Ek 2026-11-14 §5): no visibility
  if (isMain(section)) {
    return fields
  }
  fields.push(
    {
      key: "visible",
      group: "visibility",
      label: `${P}.visible`,
      term: null,
      options: [],
      target: FIELD_IDS.visible(id),
    },
    {
      key: "starts_at",
      group: "visibility",
      label: `${P}.startsAt`,
      term: null,
      options: [],
      target: FIELD_IDS.starts(id),
    },
    {
      key: "ends_at",
      group: "visibility",
      label: `${P}.endsAt`,
      term: null,
      options: [],
      target: FIELD_IDS.ends(id),
    }
  )
  return fields
}
