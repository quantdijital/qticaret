import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTaxRatesWorkflow, createTaxRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"
import { DEFAULT_VAT_RATE, SYSTEM_TAX_PROVIDER_ID, TR_COUNTRY_CODE } from "../../lib/tax"

interface RegionRow {
  id: string
  province_code: string | null
  tax_rates: ({ is_default: boolean } | null)[]
}

/** The country-level TR tax region (province regions are its children), or null. */
export async function findVatRegion(container: MedusaContainer): Promise<RegionRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "tax_region",
    fields: ["id", "province_code", "tax_rates.is_default"],
    filters: { country_code: TR_COUNTRY_CODE },
  })
  return (data as RegionRow[]).find((region) => !region.province_code) ?? null
}

async function createVatRegion(container: MedusaContainer): Promise<string> {
  try {
    const { result } = await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: TR_COUNTRY_CODE,
          provider_id: SYSTEM_TAX_PROVIDER_ID,
          default_tax_rate: { ...DEFAULT_VAT_RATE },
        },
      ],
    })
    const created = result[0]
    if (!created) {
      throw new Error("createTaxRegionsWorkflow returned no tax region")
    }
    logger.info(
      { event: "tax.region_created", taxRegionId: created.id, code: DEFAULT_VAT_RATE.code },
      "created the TR tax region"
    )
    return created.id
  } catch (error) {
    // Another request made it meanwhile: one country-level region per country
    const made = await findVatRegion(container)
    if (made) {
      return made.id
    }
    throw error
  }
}

/**
 * The shop's KDV region (adr/0007): made with the default KDV %20 when
 * missing, as a new shop's bootstrap does; a region left without a default
 * rate gets it back. Returns its id.
 */
export async function ensureVatRegion(container: MedusaContainer): Promise<string> {
  const region = await findVatRegion(container)
  if (!region) {
    return createVatRegion(container)
  }
  if (!region.tax_rates.some((rate) => rate?.is_default)) {
    await createTaxRatesWorkflow(container).run({
      input: [{ tax_region_id: region.id, ...DEFAULT_VAT_RATE, is_default: true }],
    })
    logger.info(
      { event: "tax.default_rate_added", taxRegionId: region.id, code: DEFAULT_VAT_RATE.code },
      "added the default KDV rate"
    )
  }
  return region.id
}
