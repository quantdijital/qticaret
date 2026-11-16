import type { AppearanceSettings } from "@qticaret/types"
import { applyAppearance } from "@qticaret/admin-ui/theme"

/**
 * The control plane's colours: fixed, no setting (adr/0061 §1.4), and on
 * purpose not the shop panel's. Indigo-violet where the shop panel's
 * default is blue, and the permanent "Üst panel" bar in that colour above
 * every page; a member never mistakes one panel for the other. The same
 * theme engine (docs/18 §5) derives every token, so contrast holds; light
 * or dark follows the system. Nothing is stored in the browser: the shop
 * panel's remembered colours (`bootTheme`) are not this panel's.
 */
export const CONTROL_PLANE_APPEARANCE: AppearanceSettings = {
  brand_color: "#5b21b6",
  radius: "soft",
  density: "comfortable",
  mode: "system",
  sidebar: "dark",
  sidebar_mode: "expanded",
  logo_light_url: null,
  logo_dark_url: null,
  favicon_url: null,
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

/** First paint, and again when the system's light or dark changes. */
export function paintControlPlaneTheme(): void {
  applyAppearance(CONTROL_PLANE_APPEARANCE)
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    applyAppearance(CONTROL_PLANE_APPEARANCE)
  })
}
