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
 * Makes TRY the store's default currency with tax-inclusive prices and points
 * the store at the TR region. `updateStoresWorkflow` writes the currency
 * price preferences; `updateStoresStep` alone would not (adr/0007).
 *
 * Other currencies the tenant added are kept with their current
 * tax-inclusive flag, so running this again changes nothing.
 */
export async function ensureStoreDefaults(
  container: MedusaContainer,
  regionId: string
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })
  const store = stores[0]
  if (!store) {
    throw new Error("bootstrap: no store found; start the server once so Medusa creates it")
  }

  const otherCodes = store.supported_currencies
    .map((currency) => currency?.currency_code)
    .filter((code): code is string => !!code && code !== TRY_CURRENCY_CODE)

  const taxInclusive = await taxInclusiveCurrencies(container, otherCodes)
  const currencies: StoreCurrency[] = [
    { currency_code: TRY_CURRENCY_CODE, is_default: true, is_tax_inclusive: true },
    ...otherCodes.map((code) => ({
      currency_code: code,
      is_default: false,
      is_tax_inclusive: taxInclusive.has(code),
    })),
  ]

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { supported_currencies: currencies, default_region_id: regionId },
    },
  })
  logger.info(`bootstrap: store ${store.id} defaults to ${TRY_CURRENCY_CODE}, tax inclusive`)
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
