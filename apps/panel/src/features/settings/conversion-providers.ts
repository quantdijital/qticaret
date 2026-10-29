/**
 * Where the shop's purchases are told from the server (F10.9, adr/0038
 * §4), as Settings > Marketing lists them: Meta's pixel and GA4's stream,
 * each on its own page. The id is the provider's key in
 * `integration-credentials` and in the page's address.
 */
export const CONVERSION_PROVIDERS = [{ id: "meta" }, { id: "ga4" }] as const

export type ConversionProviderId = (typeof CONVERSION_PROVIDERS)[number]["id"]

export const isConversionProvider = (id: string): id is ConversionProviderId =>
  CONVERSION_PROVIDERS.some((provider) => provider.id === id)
