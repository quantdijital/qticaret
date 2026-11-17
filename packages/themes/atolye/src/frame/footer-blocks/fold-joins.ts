import type { FooterBlockView, FooterRowView, ShopView } from "@qticaret/ui"

/**
 * How a closed menu meets the one before it below 1024 px: `block` in its
 * own column, `column` across the stacked columns (one column on a phone).
 */
export type FoldJoin = "block" | "column"

/** The blocks that draw nothing (FooterBlock's `null`): they take no box. */
export const blockDrawn = (block: FooterBlockView, shop: ShopView, subscribe: boolean) => {
  if (block.type === "newsletter") {
    return subscribe
  }
  if (block.type === "social") {
    return shop.footerBar?.social !== "hidden"
  }
  return block.type !== "app_badges"
}

const folds = (block: FooterBlockView) => block.type === "menu" && block.collapsePhone

/**
 * The closed menus that follow another one in a row's phone reading order
 * (row, column, block; a computer's blocks left out): drawn joined, one
 * list with one rule between, as the brand columns' accordion. Keyed by the
 * block's id; a block not in the map stands on its own.
 */
export function foldJoins(
  row: FooterRowView,
  shop: ShopView,
  subscribe: boolean
): ReadonlyMap<string, FoldJoin> {
  const joins = new Map<string, FoldJoin>()
  // Whether the last block shown on a phone was a closed menu, and in which column
  let last: { fold: boolean; column: number } | null = null
  row.columns.forEach((column, at) => {
    const drawn = column.blocks.filter((block) => blockDrawn(block, shop, subscribe))
    const shown = drawn.filter((block) => block.device !== "desktop")
    if (shown.length === 0 && drawn.length > 0) {
      // A column of a computer's blocks keeps its box (and its gap) on a phone
      last = null
      return
    }
    for (const block of shown) {
      if (folds(block) && last?.fold) {
        joins.set(block.id, last.column === at ? "block" : "column")
      }
      last = { fold: folds(block), column: at }
    }
  })
  return joins
}
