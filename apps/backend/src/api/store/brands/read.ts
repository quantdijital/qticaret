import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import type { BrandRecord } from "../../../modules/brands/service"

/**
 * What a storefront lists of a brand; ids of files and the switch stay
 * inside, and so does its text (up to 20,000 characters, adr/0075): only
 * the brand's own page reads it (`storeBrand`).
 */
export const storeBrandSummary = (brand: BrandRecord) => ({
  id: brand.id,
  name: brand.name,
  handle: brand.handle,
  logo_url: brand.logo_url,
  // Read on the server when the logo was set; null when unknown (the theme then waits for the file)
  logo_width: brand.logo_width,
  logo_height: brand.logo_height,
})

/** What a brand's page shows of it: the list's fields and its plain text. */
export const storeBrand = (brand: BrandRecord) => ({
  ...storeBrandSummary(brand),
  description: brand.description,
})

/** An active brand, or 404: an inactive brand's page is not public. */
export async function activeBrand(container: MedusaContainer, id: string): Promise<BrandRecord> {
  const [brand] = await container
    .resolve<BrandsModuleService>(BRANDS_MODULE)
    .listBrands({ id, is_active: true }, { take: 1 })
  if (!brand) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "brands.unknown")
  }
  return brand
}
