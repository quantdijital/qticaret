import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { TRY_CURRENCY_CODE } from "./constants"

interface StoreCurrency {
  currency_code: string
  is_default: boolean
  is_tax_inclusive: boolean
}

/**
 * Adds TRY as the store's default, tax-inclusive currency and points the
 * store at the TR region, each only when not set yet. Once TRY is there,
 * the tenant's currency choices and default region are left as they are.
 *
 * `updateStoresWorkflow` writes the currency price preferences;
 * `updateStoresStep` alone would not (adr/0007).
 */
export async function ensureStoreDefaults(
  container: MedusaContainer,
  regionId: string
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_region_id", "supported_currencies.currency_code"],
  })
  const store = stores[0]
  if (!store) {
    throw new Error("bootstrap: no store found; start the server once so Medusa creates it")
  }

  const codes = store.supported_currencies
    .map((currency) => currency?.currency_code)
    .filter((code): code is string => !!code)
  const hasTry = codes.includes(TRY_CURRENCY_CODE)
  const hasDefaultRegion = !!store.default_region_id
  if (hasTry && hasDefaultRegion) {
    logger.info(`bootstrap: store ${store.id} already has ${TRY_CURRENCY_CODE}, keeping it`)
    return
  }

  const currencies = hasTry ? undefined : await withTryAsDefault(container, codes)
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        ...(currencies ? { supported_currencies: currencies } : {}),
        ...(hasDefaultRegion ? {} : { default_region_id: regionId }),
      },
    },
  })
  logger.info(`bootstrap: store ${store.id} defaults to ${TRY_CURRENCY_CODE}, tax inclusive`)
}

/** TRY first as default; existing currencies keep their tax-inclusive flag. */
async function withTryAsDefault(
  container: MedusaContainer,
  otherCodes: string[]
): Promise<StoreCurrency[]> {
  const taxInclusive = await taxInclusiveCurrencies(container, otherCodes)
  return [
    { currency_code: TRY_CURRENCY_CODE, is_default: true, is_tax_inclusive: true },
    ...otherCodes.map((code) => ({
      currency_code: code,
      is_default: false,
      is_tax_inclusive: taxInclusive.has(code),
    })),
  ]
}

async function taxInclusiveCurrencies(
  container: MedusaContainer,
  codes: string[]
): Promise<Set<string>> {
  if (codes.length === 0) {
    return new Set()
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: preferences } = await query.graph({
    entity: "price_preference",
    fields: ["value", "is_tax_inclusive"],
    filters: { attribute: "currency_code", value: codes },
  })
  return new Set(
    preferences
      .filter((preference) => preference.is_tax_inclusive)
      .map((preference) => preference.value)
      .filter((value): value is string => !!value)
  )
}
