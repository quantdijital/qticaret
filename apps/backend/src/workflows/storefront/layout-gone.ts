import type { MedusaContainer } from "@medusajs/framework/types"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { layoutTargets } from "./layout-check"
import { existingRecords } from "./menu-links"

/**
 * The parts of a design (a section's id, a free footer block's) naming a
 * record that is no more: a category, product, collection, brand or page
 * deleted since it was picked. The storefront leaves such a record out
 * (`liveRecords`) and a save no longer refuses it ("engel değil uyarı",
 * `checkLayout`); the theme editor marks the part so the shop picks again.
 * A record that exists as a draft is not gone, as on saving.
 */
export async function goneTargets(
  container: MedusaContainer,
  doc: LayoutDocument
): Promise<string[]> {
  const targets = layoutTargets(doc)
  if (targets.length === 0) {
    return []
  }
  const found = await existingRecords(container, targets)
  return [
    ...new Set(
      targets.filter((each) => !found.has(`${each.kind}:${each.target}`)).map((each) => each.part)
    ),
  ]
}
