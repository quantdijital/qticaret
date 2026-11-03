import { isStoreApiError } from "../store-api/errors"

/**
 * The backend's add-on refusals a shopper can act on (adr/0052, its
 * "Uygulama notları"), each worded in `tr.json`; the storefront shows
 * them as they come.
 */
export const ADDON_ERROR_KEYS: ReadonlySet<string> = new Set([
  "addons.unknown",
  "addons.duplicate",
  "addons.text_required",
  "addons.text_too_long",
  "addons.charset",
  "addons.text_link",
  "addons.max_quantity",
  "addons.not_addon_line",
  "addons.required",
  "addons.unavailable",
  "addons.line_locked",
  "addons.too_many",
  "cart.line_unknown",
  "catalog.addons_disabled",
])

/**
 * An add-on call's failure in words: a known refusal by its key; the
 * add-on routes' bare 404 (no key: the shop has add-ons off) as
 * `catalog.addons_disabled`; anything else is the caller's fallback.
 */
export function addonError(error: unknown, fallback: string): string {
  if (!isStoreApiError(error)) {
    return fallback
  }
  if (error.status === 429) {
    return "errors.too_many_requests"
  }
  const key = error.messageKey ?? ""
  if (ADDON_ERROR_KEYS.has(key)) {
    return key
  }
  if (error.status === 404 && key === "") {
    return "catalog.addons_disabled"
  }
  return fallback
}
