/**
 * Turkey defaults every tenant starts from (F1.1, F1.2). Values here are
 * data, not UI copy: the admin shows them as stored.
 */
export const TRY_CURRENCY_CODE = "try"
export const TR_REGION_NAME = "Türkiye"
/** The warehouse every tenant starts with (F3.7); renamed and addressed in the panel. */
export const DEFAULT_STOCK_LOCATION_NAME = "Ana Depo"

/** Providers registered by Medusa's default config. */
export const SYSTEM_PAYMENT_PROVIDER_ID = "pp_system_default"
export {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
  IYZICO_PAYMENT_PROVIDER_ID,
  PAYTR_PAYMENT_PROVIDER_ID,
} from "../../lib/payments/checkout"

/** KDV (adr/0007): the region, its default and the reduced rates a new shop starts with. */
export {
  DEFAULT_VAT_RATE,
  REDUCED_VAT_RATES,
  SYSTEM_TAX_PROVIDER_ID,
  TR_COUNTRY_CODE,
} from "../../lib/tax"
export type { ReducedVatRate } from "../../lib/tax"
