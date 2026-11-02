import type { TFunction } from "i18next"
import type { MenuRow } from "@/features/storefront/menu-rows"

/**
 * The name the storefront shows for a link without its own wording: the
 * record's, the published legal text's, or the storefront's own for its
 * pages; an address has none and must be given one.
 */
export function shownName(t: TFunction, row: MenuRow): string {
  if (row.name) {
    return row.name
  }
  switch (row.to.kind) {
    case "system":
      return t(`storefront.menus.system.${row.to.target}`)
    case "legal":
      return t(`settings.legal.kinds.${row.to.target}.name`)
    case "url":
      return t("storefront.menus.row.urlPlaceholder")
    case "category":
    case "product":
    case "collection":
    case "brand":
    case "page":
    case "post":
    case "landing":
      return t("storefront.menus.row.missing")
  }
}
