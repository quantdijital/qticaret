import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deepestCategory } from "../../../lib/catalog"
import { ValidationError } from "../../../lib/errors"
import type { PageKind } from "../../../lib/seo/advisor"
import { setProductCatalogWorkflow } from "../../catalog/set-product-catalog"
import { upsertSeoMetaWorkflow } from "../upsert-seo-meta"

/**
 * The advisor's one-click fixes (docs/14 §3, `fix.kind: "auto"`), each a
 * save the person could make by hand, run through the same workflows (so
 * checked, locked, audited by their routes' rules):
 * - `use_template_title` / `use_template_description`: the page's own
 *   text gives way to the shop's template;
 * - `set_primary_category`: a product's deepest category becomes its
 *   primary one (docs/13 §2.2).
 */
export const AUTO_FIXES = [
  "use_template_title",
  "use_template_description",
  "set_primary_category",
] as const
export type AutoFix = (typeof AUTO_FIXES)[number]

async function deepestCategoryOf(container: MedusaContainer, productId: string): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["categories.id", "categories.mpath"],
    filters: { id: productId },
  })
  interface Row {
    categories?: ({ id: string; mpath?: string | null } | null)[] | null
  }
  const product = data[0] as Row | undefined
  const deepest = deepestCategory(product?.categories ?? [])
  if (!deepest) {
    throw new ValidationError("seo.fix_not_applicable", { field: "action" })
  }
  return deepest.id
}

export async function applyFix(
  container: MedusaContainer,
  kind: PageKind,
  id: string,
  action: AutoFix
): Promise<void> {
  if (action === "set_primary_category") {
    if (kind !== "product") {
      throw new ValidationError("seo.fix_not_applicable", { field: "action" })
    }
    await setProductCatalogWorkflow(container).run({
      input: { product_id: id, primary_category_id: await deepestCategoryOf(container, id) },
    })
    return
  }
  const field = action === "use_template_title" ? "seo_title" : "seo_description"
  await upsertSeoMetaWorkflow(container).run({
    input: { entity_type: kind, entity_id: id, values: { [field]: null } },
  })
}
