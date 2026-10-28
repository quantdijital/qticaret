/**
 * The carriers a shop ships with, as Settings > Shipping lists them (docs/03
 * F7, adr/0031): Geliver, then the shop's own contracts (adr/0035). The id
 * is the provider's key in `integration-credentials` and in the page's
 * address.
 */
export const SHIPPING_CARRIERS = [{ id: "geliver" }, { id: "aras" }] as const

export type CarrierId = (typeof SHIPPING_CARRIERS)[number]["id"]

export const isCarrier = (id: string): id is CarrierId =>
  SHIPPING_CARRIERS.some((carrier) => carrier.id === id)
