/**
 * The backend's "refresh" signal (adr/0048 Ek 2026-11-03): right after the
 * shop publishes or saves something the storefront keeps a minute, the
 * backend posts here, signed with the secret both servers share; the
 * storefront drops what the change touched. Without the signal the old
 * minute stands.
 */
export const REFRESH_PATH = "/api/yenile"

export const REFRESH_SCOPES = ["layout", "settings", "menus", "legal", "content", "site"] as const

export type RefreshScope = (typeof REFRESH_SCOPES)[number]

/**
 * The shared answers each scope drops, by Store path (a path ending in
 * `/`: everything under it); `site` also drops the edge's own site facts.
 * Dropping everything would be right too: the scopes only spare the
 * backend needless reads.
 */
export const SCOPE_PATHS: Record<RefreshScope, readonly string[]> = {
  layout: ["/store/storefront-layout"],
  settings: ["/store/storefront", "/store/seo/site", "/store/legal-identity"],
  // The menus and category cards show the categories' pictures (adr/0046 Ek 2026-11-04)
  menus: ["/store/storefront-menus", "/store/category-images"],
  // A legal text's link shows in the menus only while it is published
  legal: ["/store/legal/", "/store/legal-identity", "/store/storefront-menus"],
  content: ["/store/content/terms", "/store/seo/paths", "/store/storefront-menus"],
  site: ["/store/seo/site"],
}

/** The paths the scopes drop, each once; and whether the edge's site goes too. */
export function refreshPlan(scopes: readonly RefreshScope[]): {
  paths: string[]
  edgeSite: boolean
} {
  return {
    paths: [...new Set(scopes.flatMap((scope) => SCOPE_PATHS[scope]))],
    edgeSite: scopes.includes("site"),
  }
}
