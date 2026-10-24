import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductTypesWorkflow,
  createTaxRatesWorkflow,
  createTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"
import {
  DEFAULT_VAT_RATE,
  REDUCED_VAT_RATES,
  SYSTEM_TAX_PROVIDER_ID,
  TR_COUNTRY_CODE,
} from "./constants"

/**
 * Sets up KDV for Turkey (adr/0007): a country-level tax region whose default
 * rate is 20%, plus one rate per reduced group bound to a product type.
 * Only missing records are created; rates the tenant has edited stay as they
 * are.
 */
export async function ensureVatRates(container: MedusaContainer): Promise<void> {
  const productTypeIds = await ensureVatProductTypes(container)
  const taxRegion = await ensureTrTaxRegion(container)

  const missing = REDUCED_VAT_RATES.filter((vat) => !taxRegion.rateCodes.has(vat.code))
  if (missing.length === 0) {
    logger.info({ event: "bootstrap.vat_rates_kept" }, "reduced KDV rates exist, keeping them")
    return
  }

  await createTaxRatesWorkflow(container).run({
    input: missing.map((vat) => ({
      tax_region_id: taxRegion.id,
      code: vat.code,
      name: vat.name,
      rate: vat.rate,
      rules: [
        { reference: "product_type", reference_id: requireId(productTypeIds, vat.productType) },
      ],
    })),
  })
  logger.info(
    { event: "bootstrap.vat_rates_created", codes: missing.map((vat) => vat.code) },
    "created KDV rates"
  )
}

/** Returns product type ids keyed by value, creating the missing VAT types. */
async function ensureVatProductTypes(container: MedusaContainer): Promise<Map<string, string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const values = REDUCED_VAT_RATES.map((vat) => vat.productType)

  const { data: existing } = await query.graph({
    entity: "product_type",
    fields: ["id", "value"],
    filters: { value: values },
  })
  const ids = new Map(existing.map((type) => [type.value, type.id]))

  const missing = values.filter((value) => !ids.has(value))
  if (missing.length > 0) {
    const { result } = await createProductTypesWorkflow(container).run({
      input: { product_types: missing.map((value) => ({ value })) },
    })
    for (const type of result) {
      ids.set(type.value, type.id)
    }
  }
  return ids
}

interface TrTaxRegion {
  id: string
  rateCodes: Set<string>
}

async function ensureTrTaxRegion(container: MedusaContainer): Promise<TrTaxRegion> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "province_code", "tax_rates.code", "tax_rates.is_default"],
    filters: { country_code: TR_COUNTRY_CODE },
  })
  // Province-level regions are children; KDV lives on the country level.
  const region = regions.find((candidate) => !candidate.province_code)

  if (region) {
    const rates = region.tax_rates.filter((rate) => rate !== null)
    if (!rates.some((rate) => rate.is_default)) {
      await createTaxRatesWorkflow(container).run({
        input: [{ tax_region_id: region.id, ...DEFAULT_VAT_RATE, is_default: true }],
      })
      logger.info(
        {
          event: "bootstrap.default_vat_rate_added",
          taxRegionId: region.id,
          code: DEFAULT_VAT_RATE.code,
        },
        "added default KDV rate"
      )
    }
    return { id: region.id, rateCodes: new Set(rates.map((rate) => rate.code)) }
  }

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
    throw new Error("bootstrap: createTaxRegionsWorkflow returned no tax region")
  }
  logger.info(
    { event: "bootstrap.tax_region_created", taxRegionId: created.id, code: DEFAULT_VAT_RATE.code },
    "created tax region"
  )
  return { id: created.id, rateCodes: new Set([DEFAULT_VAT_RATE.code]) }
}

function requireId(ids: Map<string, string>, value: string): string {
  const id = ids.get(value)
  if (!id) {
    throw new Error(`bootstrap: product type "${value}" is missing`)
  }
  return id
}
