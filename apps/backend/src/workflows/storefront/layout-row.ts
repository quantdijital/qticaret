import type { MedusaContainer } from "@medusajs/framework/types"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"

// The document as the JSON column takes it
export const json = (doc: LayoutDocument) => doc as unknown as Record<string, unknown>

export const layouts = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)

export interface LayoutRow {
  id: string
  draft: unknown
  published: unknown
  published_at: Date | null
  published_by: string | null
  revision: number
}

/** The shop's one design record, if it has made one. */
export async function layoutRow(
  container: Pick<MedusaContainer, "resolve">
): Promise<LayoutRow | null> {
  const [row] = await layouts(container).listStorefrontLayouts({}, { take: 1 })
  return (row as LayoutRow | undefined) ?? null
}
