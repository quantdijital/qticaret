import { shelfJoins } from "@qticaret/types"
import type { AnySection, ProductsSection } from "@/features/storefront/api/layout"

/**
 * The product rails a rail shares one tabbed shelf with on the page
 * (bilesen-denetimi (b) 2), as the theme joins them (`blocksOf`): rails
 * standing next to each other that may both join, a hidden section left
 * out (the storefront does not draw it). Empty: the rail stands alone.
 * The storefront also leaves out a rail with nothing to show or out of its
 * dates, so the panel's answer is the page as the shop laid it out.
 */
export function tabMates(sections: readonly AnySection[], id: string): ProductsSection[] {
  let run: ProductsSection[] = []
  for (const section of sections) {
    if (!section.visible) {
      continue
    }
    if (section.type === "products" && shelfJoins(section) && run.every(shelfJoins)) {
      run.push(section)
    } else {
      if (run.some((rail) => rail.id === id)) {
        break
      }
      run = section.type === "products" ? [section] : []
    }
  }
  return run.some((rail) => rail.id === id) ? run.filter((rail) => rail.id !== id) : []
}
