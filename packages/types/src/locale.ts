/** Locales the platform serves. Turkish is the default; more arrive with F19. */
export const SUPPORTED_LOCALES = ["tr"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "tr"

/** ISO 4217 currencies the platform prices in. */
export const SUPPORTED_CURRENCIES = ["try"] as const
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]
export const DEFAULT_CURRENCY: CurrencyCode = "try"

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
