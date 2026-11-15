import {
  BANNER_SETTINGS,
  HEADER_MENU_GROUNDS,
  MARQUEE_SETTINGS,
  SECTION_VARIANTS,
} from "@qticaret/types"
import type { BannerSetting, MarqueeSetting, SectionLookField } from "@qticaret/types"
import type {
  AnySection,
  HeaderCatalogFields,
  LayoutGroup,
  LookedSection,
} from "@/features/storefront/api/layout"
import { lookFieldsFor, lookStepsFor } from "@/features/storefront/layout/look"
import { isBodyGroup } from "@/features/storefront/layout/sections"
import { isMain } from "@/features/storefront/layout/main-sections"
import { offersVariants } from "@/features/storefront/layout/variants"
import { SHELF_IDS, shelfFields } from "./shelf-registry"

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
export type FieldGroupName =
  | "variant"
  | "placement"
  | "content"
  | "layout"
  | "scroll"
  | "motion"
  | "appearance"
  | "look"
  | "visibility"

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
const BANNER = "storefront.editor.banner"
const HEADER = "storefront.editor.headerBar"

/**
 * Where the catalog header's settings sit (adr/0049 Ek 2026-11-15, the
 * owner's rule: the basics open and first): what it shows and its menu
 * bar's ground with the header's own content; the written search button,
 * the written account link and the cart's subtotal closed in "Diğer
 * ayarlar". In the form's order.
 */
export const HEADER_CATALOG_GROUPS: Readonly<Record<keyof HeaderCatalogFields, FieldGroupName>> = {
  search_placeholder: "content",
  utility_bar: "content",
  phone: "content",
  categories_button: "content",
  menu_ground: "content",
  highlight_link: "content",
  search_label: "look",
  account_text: "look",
  cart_total: "look",
}

export type HeaderCatalogField = keyof HeaderCatalogFields

/** The catalog header's fields of a group, in the form's order. */
export const headerCatalogIn = (group: FieldGroupName): HeaderCatalogField[] =>
  (Object.keys(HEADER_CATALOG_GROUPS) as HeaderCatalogField[]).filter(
    (field) => HEADER_CATALOG_GROUPS[field] === group
  )

/**
 * Where a strip's settings sit (adr/0049 Ek 2026-11-15, the owner's "kayma
 * hızı ayarı yok": it was there, in a closed group): how it moves and how
 * it looks in two open groups under its items, the rarely changed ones
 * (the screens, the close button) closed in "Diğer ayarlar" with the
 * page's look.
 */
const MARQUEE_GROUPS: Readonly<Record<MarqueeSetting, FieldGroupName>> = {
  speed: "motion",
  direction: "motion",
  hover_pause: "motion",
  pause_button: "motion",
  size: "appearance",
  ground: "appearance",
  separator: "appearance",
  weight: "appearance",
  uppercase: "appearance",
  gap: "appearance",
  outline: "appearance",
  device: "look",
  closable: "look",
}

const settingsIn = (group: FieldGroupName): readonly MarqueeSetting[] =>
  (Object.keys(MARQUEE_SETTINGS) as MarqueeSetting[]).filter(
    (setting) => MARQUEE_GROUPS[setting] === group
  )

/** How the strip moves: the open "Hareket" group. */
export const MARQUEE_MOTION_SETTINGS = settingsIn("motion")

/** How it looks: the open "Görünüm" group. */
export const MARQUEE_APPEARANCE_SETTINGS = settingsIn("appearance")

/** The rarely changed ones, in the closed "Diğer ayarlar" group with the page's look. */
export const MARQUEE_OTHER_SETTINGS = settingsIn("look")

/** Whether the strip offers the setting as it stands: the outline only at the large size. */
export const marqueeOffers = (section: { size: string }, setting: MarqueeSetting): boolean =>
  setting !== "outline" || section.size === "large"

/** The settings told as a switch: two steps, one of them "on". */
export const isSwitch = (setting: MarqueeSetting): boolean => {
  const steps: readonly string[] = MARQUEE_SETTINGS[setting]
  return steps.length === 2 && steps.includes("on") && steps.includes("off")
}

/** The elements' ids, shared by the forms and the search. */
export const FIELD_IDS = {
  variant: (sectionId: string) => `${sectionId}-variant`,
  placement: (sectionId: string) => `${sectionId}-placement`,
  look: (sectionId: string, field: SectionLookField) => `${sectionId}-look-${field}`,
  marquee: (sectionId: string, setting: MarqueeSetting) => `${sectionId}-marquee-${setting}`,
  banner: (sectionId: string, setting: BannerSetting) => `${sectionId}-banner-${setting}`,
  ...SHELF_IDS,
  sticky: (sectionId: string) => `${sectionId}-sticky`,
  header: (sectionId: string, field: HeaderCatalogField) => `${sectionId}-header-${field}`,
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
      // A product rail's sits first in its open "Diziliş"
      group: section.type === "products" ? "layout" : "variant",
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
      if (!marqueeOffers(section, setting)) {
        continue
      }
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
  // The band's settings sit with the look, in the closed "Görünüm ayarları" group
  if (section.type === "banner") {
    for (const [setting, steps] of Object.entries(BANNER_SETTINGS) as [
      BannerSetting,
      readonly string[],
    ][]) {
      fields.push({
        key: `banner.${setting}`,
        group: "look",
        label: `${BANNER}.${setting}.label`,
        term: `${BANNER}.${setting}.term`,
        options: steps.map((step) => `${BANNER}.${setting}.${step}`),
        target: FIELD_IDS.banner(id, setting),
      })
    }
  }
  if (section.type === "products") {
    fields.push(...shelfFields(section))
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
    if (section.variant === "catalog") {
      for (const field of Object.keys(HEADER_CATALOG_GROUPS) as HeaderCatalogField[]) {
        fields.push({
          key: `header.${field}`,
          group: HEADER_CATALOG_GROUPS[field],
          label: `${HEADER}.${field}.label`,
          term: `${HEADER}.${field}.term`,
          options:
            field === "menu_ground"
              ? HEADER_MENU_GROUNDS.map((ground) => `${HEADER}.menu_ground.${ground}`)
              : [],
          target: FIELD_IDS.header(id, field),
        })
      }
    }
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
