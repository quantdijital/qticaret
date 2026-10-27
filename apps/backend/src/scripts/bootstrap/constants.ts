/**
 * Turkey defaults every tenant starts from (F1.1, F1.2). Values here are
 * data, not UI copy: the admin shows them as stored.
 */
export const TR_COUNTRY_CODE = "tr"
export const TRY_CURRENCY_CODE = "try"
export const TR_REGION_NAME = "Türkiye"
/** The warehouse every tenant starts with (F3.7); renamed and addressed in the panel. */
export const DEFAULT_STOCK_LOCATION_NAME = "Ana Depo"

/** Providers registered by Medusa's default config. */
export const SYSTEM_PAYMENT_PROVIDER_ID = "pp_system_default"
export { PAYTR_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
export const SYSTEM_TAX_PROVIDER_ID = "tp_system"

/**
 * KDV groups (adr/0007): products without a VAT product type get the default
 * rate; each reduced rate is bound to a product type of the same name.
 */
export const DEFAULT_VAT_RATE = { code: "KDV20", name: "KDV %20", rate: 20 } as const

export const REDUCED_VAT_RATES = [
  { code: "KDV10", name: "KDV %10", rate: 10, productType: "KDV %10" },
  { code: "KDV1", name: "KDV %1", rate: 1, productType: "KDV %1" },
] as const

export type ReducedVatRate = (typeof REDUCED_VAT_RATES)[number]
