import type { MedusaResponse } from "@medusajs/framework/http"

/** The header Medusa reads a store request's sales channels from. */
export const PUBLISHABLE_KEY_HEADER = "x-publishable-api-key"

/**
 * Keys a shared cache on the publishable key (docs/04): a `public` store
 * answer that depends on the key's sales channels must not be served to
 * another channel, nor to a request without a key, which Medusa rejects.
 * Added to any earlier `Vary` (CORS's `Origin`), not in its place.
 */
export function varyOnPublishableKey(res: Pick<MedusaResponse, "vary">): void {
  res.vary(PUBLISHABLE_KEY_HEADER)
}
