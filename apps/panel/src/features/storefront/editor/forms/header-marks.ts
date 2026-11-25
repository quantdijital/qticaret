import type { HeaderBarSection } from "@/features/storefront/api/layout"
import { HEADER_CATALOG_DEFAULTS } from "@/features/storefront/layout/variants"
import { HEADER_GROUPS, headerCatalogIn } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { headerCatalogOffers } from "./header-catalog-steps"

/** Every header's own settings as a new one has them (the steps' first, staying at the top, on its own ground). */
const HEADER_DEFAULTS = {
  search_style: "field",
  menu_images: "submenus",
  sticky: true,
  over_cover: false,
} as const

/**
 * How many of a group's header settings the shop moved off their
 * defaults, of those the panel offers as the bar stands: its title's mark
 * (adr/0065 Ek, sekmeler), as the look groups count theirs. Words and
 * links count once written.
 */
export function headerSetIn(section: HeaderBarSection, group: FieldGroupName): number {
  const own = (Object.keys(HEADER_GROUPS) as (keyof typeof HEADER_GROUPS)[]).filter(
    (field) =>
      HEADER_GROUPS[field] === group &&
      (section[field] ?? HEADER_DEFAULTS[field]) !== HEADER_DEFAULTS[field]
  ).length
  if (section.variant !== "catalog") {
    // The action button counts once written, with the menu bar's settings
    return own + (group === "menu" && section.highlight_link ? 1 : 0)
  }
  const catalog = section
  return (
    own +
    headerCatalogIn(group).filter(
      (field) =>
        headerCatalogOffers(catalog, field) && catalog[field] !== HEADER_CATALOG_DEFAULTS[field]
    ).length
  )
}
