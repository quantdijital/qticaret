import { CATEGORY_ICONS_SETTINGS } from "@qticaret/types"
import type { SectionIcon } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { ContentField } from "./content-registry"
import type { RegistryField } from "./field-registry"

/** A field's element id (`CONTENT_IDS.content`), passed in so the two registries need not import each other. */
type Target = (sectionId: string, field: ContentField) => string

const E = "storefront.editor"

/** One setting of "Diziliş" as the settings search finds it: label, term and steps' names. */
const layoutEntry = (
  target: Target,
  section: AnySection,
  field: ContentField,
  at: string,
  options: readonly string[] = []
): RegistryField => ({
  key: field,
  group: "layout",
  label: `${at}.label`,
  term: `${at}.term`,
  options: options.map((step) => `${at}.${step}`),
  target: target(section.id, field),
})

/**
 * The icon sections' settings in "Diziliş" (adr/0077 §10 Ek), as their
 * forms show them: the figures' icon switch, the trust card's lift, the
 * icon row's disc and phone row. Each only on the section and variant that
 * has it.
 */
export function iconFields(section: AnySection, target: Target): RegistryField[] {
  if (section.type === "stats") {
    return [layoutEntry(target, section, "show_icons", `${E}.stats.icons`)]
  }
  if (section.type === "trust_badges" && section.variant === "card") {
    return [layoutEntry(target, section, "lift", `${E}.trustCard.lift`)]
  }
  if (section.type === "categories" && section.variant === "icons") {
    const at = `${E}.categoryIcons`
    return [
      layoutEntry(target, section, "disc", `${at}.disc`, CATEGORY_ICONS_SETTINGS.disc),
      layoutEntry(target, section, "icons_phone", `${at}.phone`, CATEGORY_ICONS_SETTINGS.phone),
      layoutEntry(
        target,
        section,
        "icons_row_style",
        `${at}.row_style`,
        CATEGORY_ICONS_SETTINGS.row_style
      ),
    ]
  }
  return []
}

/** The icon row's icons kept for the categories still named, so a removed one leaves none behind. */
export function iconsFor(
  ids: readonly string[],
  icons: Readonly<Record<string, SectionIcon>>
): Record<string, SectionIcon> {
  return Object.fromEntries(Object.entries(icons).filter(([id]) => ids.includes(id)))
}
