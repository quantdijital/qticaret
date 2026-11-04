import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductTypesWorkflow, createTaxRatesWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"
import { sameVatRate } from "../../lib/tax"
import { ensureVatRegion } from "../../workflows/tax/region"
import { REDUCED_VAT_RATES } from "./constants"
import type { ReducedVatRate } from "./constants"

/**
 * Sets up KDV for Turkey (adr/0007): a country-level tax region whose
 * default rate is 20%, plus one rate per reduced group bound to a product
 * type. The shop manages its rates in the panel afterwards (adr/0007 Ek
 * 2026-11-04), so a rate is known by its code: one the shop renamed, made
 * the default or removed (the tax module keeps it soft-deleted) is never
 * made again, nor its product type.
 */
export async function ensureVatRates(container: MedusaContainer): Promise<void> {
  const regionId = await ensureVatRegion(container)
  const known = await knownRates(container, regionId)

  // Nor one whose percentage the shop charges under a rate of its own
  const missing = REDUCED_VAT_RATES.filter(
    (vat) =>
      !known.codes.has(vat.code) && !known.percentages.some((rate) => sameVatRate(rate, vat.rate))
  )
  if (missing.length === 0) {
    logger.info({ event: "bootstrap.vat_rates_kept" }, "reduced KDV rates exist, keeping them")
    return
  }

  const productTypeIds = await ensureVatProductTypes(container, missing)
  await createTaxRatesWorkflow(container).run({
    input: missing.map((vat) => ({
      tax_region_id: regionId,
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

/** The region's rate codes, the removed ones' too, and the percentages in use. */
async function knownRates(
  container: MedusaContainer,
  regionId: string
): Promise<{ codes: Set<string>; percentages: number[] }> {
  const rates = await container
    .resolve(Modules.TAX)
    .listTaxRates(
      { tax_region_id: regionId },
      { select: ["code", "rate", "deleted_at"], withDeleted: true, take: 500 }
    )
  return {
    codes: new Set(rates.flatMap((rate) => (rate.code ? [rate.code] : []))),
    percentages: rates.flatMap((rate) => (rate.deleted_at ? [] : [rate.rate ?? 0])),
  }
}

/** Product type ids keyed by value, for the rates about to be made: a standing one, or a new one. */
async function ensureVatProductTypes(
  container: MedusaContainer,
  rates: readonly ReducedVatRate[]
): Promise<Map<string, string>> {
  const values = rates.map((vat) => vat.productType)
  const { data: existing } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
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

function requireId(ids: Map<string, string>, value: string): string {
  const id = ids.get(value)
  if (!id) {
    throw new Error(`bootstrap: product type "${value}" is missing`)
  }
  return id
}
