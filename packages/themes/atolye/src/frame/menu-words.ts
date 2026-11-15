import type { NavCategoryView, Translate } from "@qticaret/ui"
import { allInOf } from "./header-words"

/** A menu row's product count: "58" in its pill, "58 ürün" for a screen reader. */
export interface CountWords {
  shown: string
  said: string
}

/** What the header's dropdown and the phone's sheet say, worked out once on the server. */
export interface MenuWords {
  /** "Tümünü gör", the last row's words. */
  seeAll: string
  /** "Tümünü gör: {name}" for each category path, in words. */
  allIn: Record<string, string>
  /** Each counted category path's count; a path not here shows no badge. */
  counts: Record<string, CountWords>
}

/**
 * The menu's words from the shop's categories: each entry and child with
 * a count of one or more gets its pill (the storefront leaves none where
 * the backend did not count, so a row never shows a wrong number).
 */
export function menuWords(categories: readonly NavCategoryView[], t: Translate): MenuWords {
  const counts: Record<string, CountWords> = {}
  for (const entry of categories.flatMap((category) => [category, ...category.children])) {
    if (typeof entry.count === "number" && entry.count > 0) {
      const shown = entry.count.toLocaleString("tr-TR")
      counts[entry.path] = { shown, said: t("listing.count", { count: shown }) }
    }
  }
  return {
    seeAll: t("categories.see_all"),
    allIn: allInOf(categories, t),
    counts,
  }
}
