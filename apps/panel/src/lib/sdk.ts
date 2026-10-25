import Medusa from "@medusajs/js-sdk"

/**
 * The panel's API client: same origin as the backend (adr/0022 §4), the
 * session cookie as credentials. No token is kept in the browser.
 */
export const sdk = new Medusa({
  baseUrl: window.location.origin,
  auth: { type: "session" },
})
