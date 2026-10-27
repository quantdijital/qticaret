/**
 * The carriers a shop ships with, as Settings > Shipping lists them (docs/03
 * F7, adr/0031). Geliver first; a direct carrier joins with F7.14. The id is
 * the provider's key in `integration-credentials` and in the page's address.
 */
export const SHIPPING_CARRIERS = [{ id: "geliver" }] as const

export type CarrierId = (typeof SHIPPING_CARRIERS)[number]["id"]

export const isCarrier = (id: string): id is CarrierId =>
  SHIPPING_CARRIERS.some((carrier) => carrier.id === id)
