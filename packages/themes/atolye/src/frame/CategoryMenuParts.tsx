import type { CategoryCardView } from "@qticaret/ui"
import { MenuThumb } from "./MenuParts"

/** A row of the "Kategoriler" column or a panel; its hovered and open fill is the recipe's (`.gf-menu-row`). */
export const LINK =
  "gf-menu-row flex min-h-11 items-center gap-2 rounded-inner px-3 text-sm leading-snug text-text-2 no-underline hover:text-text"
// With the pictures: the dropdown's row (`menu.css`), 48 px, the square 8 px in, the name 12 px past it
export const PICTURED =
  "gf-menu-row flex min-h-12 items-center gap-3 rounded-inner px-2 py-1 text-sm leading-snug text-text-2 no-underline hover:text-text"

/**
 * A category's panel: two columns for a long list, one narrow for a short;
 * wider with the pictures. Either is as tall as its own rows (owner,
 * 2026-11-15: a two-column panel stood the whole "Kategoriler" column's
 * height, an empty ground under a few rows).
 */
export function panelWidth(wide: boolean, pictures: boolean): string {
  if (wide) {
    return pictures ? "w-[min(34rem,calc(100vw-26rem))]" : "w-[min(34rem,calc(100vw-24rem))]"
  }
  return pictures ? "w-72" : "w-64"
}

/** A row's words, with its category's square before them when the pictures show. */
export function Label({
  category,
  size,
  pictures,
}: {
  category: CategoryCardView
  size: 36 | 40
  pictures: boolean
}) {
  if (!pictures) {
    return <span className="gf-menu-word">{category.label}</span>
  }
  return (
    <>
      <MenuThumb category={category} size={size} />
      <span className="gf-menu-word flex-1">{category.label}</span>
    </>
  )
}
