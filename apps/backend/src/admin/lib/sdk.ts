import Medusa from "@medusajs/js-sdk"

/** The admin's API client (docs/06): the dashboard's session cookie, same origin unless VITE_BACKEND_URL says otherwise. */
const backendUrl = import.meta.env.VITE_BACKEND_URL

export const sdk = new Medusa({
  // Unset or empty: the admin is served by the backend itself
  baseUrl: backendUrl === undefined || backendUrl === "" ? "/" : backendUrl,
  debug: import.meta.env.DEV,
  auth: { type: "session" },
})
