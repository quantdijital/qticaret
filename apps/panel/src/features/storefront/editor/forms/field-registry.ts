import {
  BANNER_SETTINGS,
  HEADER_MENU_IMAGES,
  HEADER_SEARCH_STYLES,
  MARQUEE_SETTINGS,
} from "@qticaret/types"
import type { BannerSetting, MarqueeSetting, SectionLookField } from "@qticaret/types"
import type {
  AnySection,
  HeaderCatalogFields,
  LayoutGroup,
  LookedSection,
} from "@/features/storefront/api/layout"
import { lookFieldsFor, lookStep, lookStepsFor } from "@/features/storefront/layout/look"
import { isFooterBody } from "@/features/storefront/layout/footer-group"
import { isPageGroup } from "@/features/storefront/layout/sections"
import { offeredVariants, offersVariants } from "@/features/storefront/layout/variants"
import { ANNOUNCEMENT_IDS, announcementFields } from "./announcement-registry"
import { cardFooterFields } from "./card-field-ids"
import type { FooterPart } from "../footer-rows/footer-rows-fields"
import { BANNER_GROUPS } from "./banner-groups"
import { CONTENT_IDS, contentFields } from "./content-registry"
import { isFooterBand } from "./newsletter-band"
import {
  HEADER_CATALOG_STEPS,
  headerCatalogOffers,
  isHeaderCatalogStep,
} from "./header-catalog-steps"
import { SHELF_IDS, shelfFields } from "./shelf-registry"
import { VISIBILITY_IDS, visibilityFields } from "./visibility-registry"

/**
 * The section panel's fields as the settings search knows them (adr/0049
 * Ek 2026-11-14 §6): one register built from what the forms are built
 * from, never a second list. The "Biçim" choice reads the type's variants
 * (`SECTION_VARIANTS`, as `VariantField`), the look's fields what the type
 * offers (`lookFieldsFor`, as `LookFields`), the place and the schedule
 * the panel's own groups; the forms take their elements' ids from here,
 * so a search lands on the field it names.
 */

/**
 * The panel group a field sits in: a field in a closed group opens it.
 * Each group's tab and title: `panel-groups.ts`.
 */
export type FieldGroupName =
  | "content"
  | "buttons"
  | "categoryList"
  | "tiles"
  | "chips"
  | "picks"
  | "cards"
  | "thumbs"
  | "opening"
  | "options"
  | "backToTop"
  | "search"
  | "topBar"
  | "menu"
  | "icons"
  | "columns"
  | "phone"
  | "variant"
  | "placement"
  | "layout"
  | "scroll"
  | "controls"
  | "motion"
  | "appearance"
  | "frame"
  | "spacing"
  | "visibility"
  | "look"

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
  /** A free rows footer's row or block: its own panel opens (adr/0070 §7). */
  part?: FooterPart
}

const P = "storefront.editor.panel"
const LOOK = "storefront.editor.look"
const MARQUEE = "storefront.editor.marquee"
const BANNER = "storefront.editor.banner"
const HEADER = "storefront.editor.headerBar"

/**
 * Where the catalog header's settings sit (adr/0065 Ek, sekmeler): by the
 * part of the bar they fill, each its own closed group under "İçerik":
 * the search, the thin strip above, the menu bar, the icons and the phone.
 * In the form's order.
 */
export const HEADER_CATALOG_GROUPS: Readonly<Record<keyof HeaderCatalogFields, FieldGroupName>> = {
  search_placeholder: "search",
  search_width: "search",
  search_label: "search",
  utility_bar: "topBar",
  strip_note: "topBar",
  strip_note_link: "topBar",
  top_links: "topBar",
  categories_button: "menu",
  menu_ground: "menu",
  highlight_link: "menu",
  phone: "icons",
  tools_place: "icons",
  account_text: "icons",
  cart_total: "icons",
}

/**
 * Every header's own settings beside the catalog's: the search's look with
 * the search, the menus' pictures with the menu bar, staying at the top
 * (as Elementor's "Sticky") with the fine settings under "Gelişmiş".
 */
export const HEADER_GROUPS = {
  search_style: "search",
  menu_images: "menu",
  sticky: "look",
} as const satisfies Readonly<Record<string, FieldGroupName>>

/**
 * Where a body section's look sits: the space above, below and inside it
 * in "Boşluk" (Gelişmiş), its ground, alignment and width in "Görünüm"
 * (Stil).
 */
export const LOOK_GROUPS: Readonly<Record<SectionLookField, FieldGroupName>> = {
  space_outer: "spacing",
  space_below: "spacing",
  space_inner: "spacing",
  ground: "frame",
  align: "frame",
  width: "frame",
}

/** The look's fields of a group the type offers, in the contract's order. */
export const lookFieldsIn = (type: LookedSection["type"], group: FieldGroupName) =>
  lookFieldsFor(type).filter((field) => LOOK_GROUPS[field] === group)

/** How many of a group's look fields the shop set: its title's mark. */
export const lookSetIn = (section: LookedSection, group: FieldGroupName): number =>
  lookFieldsIn(section.type, group).filter((field) => lookStep(section, field) !== null).length

export type HeaderCatalogField = keyof HeaderCatalogFields

/** The catalog header's fields of a group, in the form's order. */
export const headerCatalogIn = (group: FieldGroupName): HeaderCatalogField[] =>
  (Object.keys(HEADER_CATALOG_GROUPS) as HeaderCatalogField[]).filter(
    (field) => HEADER_CATALOG_GROUPS[field] === group
  )

/**
 * Where a strip's settings sit (adr/0049 Ek 2026-11-15, the owner's "kayma
 * hızı ayarı yok": it was there, in a closed group): how it moves and how
 * it looks in two open groups under its items, the rarely changed close
 * button closed in "Diğer ayarlar" with the page's look. Its screens are
 * every section's, in "Görünürlük" (`visibility-registry.ts`).
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
  closable: "look",
}

const settingsIn = (group: FieldGroupName): readonly MarqueeSetting[] =>
  (Object.keys(MARQUEE_SETTINGS) as MarqueeSetting[]).filter(
    (setting) => MARQUEE_GROUPS[setting] === group
  )

/** How the strip moves: the open "Hareket" group. */
export const MARQUEE_MOTION_SETTINGS = settingsIn("motion")

/** How it looks: the open "Stil" group. */
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
  ...CONTENT_IDS,
  sticky: (sectionId: string) => `${sectionId}-sticky`,
  menuImages: (sectionId: string) => `${sectionId}-menu-images`,
  searchStyle: (sectionId: string) => `${sectionId}-search-style`,
  header: (sectionId: string, field: HeaderCatalogField) => `${sectionId}-header-${field}`,
  ...ANNOUNCEMENT_IDS,
  ...VISIBILITY_IDS,
} as const

/**
 * Whether the section takes a look: a page's body section or its main one,
 * and the footer group's sections drawn as a page's (adr/0070 §4); not the
 * header's parts, the footer's bar or its newsletter box.
 */
export const takesLook = (section: AnySection, group: LayoutGroup): section is LookedSection =>
  (isPageGroup(group) && section.type !== "announcement_bar") ||
  (group === "footer" && isFooterBody(section))

/** The fields the section's panel shows, in its order, as the search finds them. */
export function sectionFields(section: AnySection, group: LayoutGroup): RegistryField[] {
  const id = section.id
  const fields: RegistryField[] = []
  if (offersVariants(section, group === "footer", group === "pages")) {
    const variants: readonly string[] = offeredVariants(
      section,
      group === "footer",
      group === "pages"
    )
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
  // The content's counts and switches (docs/tema/bilesen-denetimi O2)
  fields.push(...contentFields(section))
  // The footer box's band on the footer's ground, under "Stil" (adr/0070 §4 Ek)
  if (isFooterBand(section, group)) {
    fields.push({
      key: "joined",
      group: "placement",
      label: "storefront.editor.newsletter.joined",
      term: "storefront.editor.newsletter.joinedTerm",
      options: [],
      target: CONTENT_IDS.content(id, "joined"),
    })
  }
  // How the announcement bar shows several lines, and how they turn
  fields.push(...announcementFields(section))
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
  // The linked category cards' and the footer's own settings (adr/0049 Ek 2026-11-15)
  fields.push(...cardFooterFields(section))
  // The band's basics open in "Diziliş", its width and buttons closed in "Diğer ayarlar"
  if (section.type === "banner") {
    for (const [setting, steps] of Object.entries(BANNER_SETTINGS) as [
      BannerSetting,
      readonly string[],
    ][]) {
      fields.push({
        key: `banner.${setting}`,
        group: BANNER_GROUPS[setting],
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
      group: HEADER_GROUPS.sticky,
      label: "storefront.editor.headerBar.sticky",
      term: "storefront.editor.headerBar.stickyTerm",
      options: [],
      target: FIELD_IDS.sticky(id),
    })
    // Every variant's: the search's look and the menus' pictures (adr/0049 Ek 2026-11-15)
    for (const [key, steps, target] of [
      ["search_style", HEADER_SEARCH_STYLES, FIELD_IDS.searchStyle(id)],
      ["menu_images", HEADER_MENU_IMAGES, FIELD_IDS.menuImages(id)],
    ] as const) {
      fields.push({
        key,
        group: HEADER_GROUPS[key],
        label: `${HEADER}.${key}.label`,
        term: `${HEADER}.${key}.term`,
        options: steps.map((step: string) => `${HEADER}.${key}.${step}`),
        target,
      })
    }
    if (section.variant === "catalog") {
      for (const field of Object.keys(HEADER_CATALOG_GROUPS) as HeaderCatalogField[]) {
        // Only what the bar offers as it stands (`headerCatalogOffers`)
        if (!headerCatalogOffers(section, field)) {
          continue
        }
        const steps: readonly string[] = isHeaderCatalogStep(field)
          ? HEADER_CATALOG_STEPS[field]
          : []
        fields.push({
          key: `header.${field}`,
          group: HEADER_CATALOG_GROUPS[field],
          label: `${HEADER}.${field}.label`,
          term: `${HEADER}.${field}.term`,
          options: steps.map((step) => `${HEADER}.${field}.${step}`),
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
        group: LOOK_GROUPS[field],
        label: `${LOOK}.${field}.label`,
        term: `${LOOK}.${field}.term`,
        options: steps.map((step) => `${LOOK}.${field}.${step}`),
        target: FIELD_IDS.look(id, field),
      })
    }
  }
  // Whether, when and where it shows; a main section always does (adr/0049 Ek 2026-11-14 §5)
  fields.push(...visibilityFields(section, group))
  return fields
}
