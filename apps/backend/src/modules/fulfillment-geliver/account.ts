import { geliverCredentialsOf } from "../../lib/shipping/geliver"
import type { GeliverCredentials } from "../../lib/shipping/geliver"
import { storedCarrierAccount } from "../../lib/shipping/shop"

export { shippingRates } from "../../lib/shipping/shop"

/**
 * The shop's Geliver account at the time of the call (adr/0027, adr/0031),
 * from the app's shared container like the payment providers' accounts.
 * Refused when nothing is stored: no shipment without the shop's account.
 */
export const storedGeliverAccount = (): Promise<GeliverCredentials> =>
  storedCarrierAccount("geliver", geliverCredentialsOf)
