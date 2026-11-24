import type { MedusaContainer } from "@medusajs/framework/types"
import { storedBadgeOf } from "../../lib/catalog/badge"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ProductBadgeSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { soldAtLeastIds } from "./best-sellers"

type Container = Pick<MedusaContainer, "resolve">

/** The window "Çok satan" counts the units over. */
export const BEST_SELLER_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The one badge a card shows on its photo (the owner, 2026-11-24): the
 * product's own line, else "Çok satan", else "Yeni". `text` only on the
 * product's own; the storefront says the other two in its words.
 */
export type CardBadge = { kind: "manual"; text: string } | { kind: "best_seller" } | { kind: "new" }

export interface BadgeProduct {
  id: string
  created_at?: string | Date | null
  product_extension?: { badge?: string | null } | null
}

/** Whether a product was made within the last `days` (a date it cannot read is not new). */
export function isNewProduct(createdAt: BadgeProduct["created_at"], days: number, now: Date) {
  if (!createdAt) {
    return false
  }
  const made = new Date(createdAt).getTime()
  return Number.isFinite(made) && made <= now.getTime() && now.getTime() - made <= days * DAY_MS
}

/** Whether any badge is on: with none, a card's read asks nothing more. */
export const anyBadgeOn = (settings: ProductBadgeSettings): boolean =>
  settings.manual_enabled || settings.new_enabled || settings.best_seller_enabled

/** A product's badge by the shop's settings, highest first; null when none is on or applies. */
export function badgeOf(
  product: BadgeProduct,
  settings: ProductBadgeSettings,
  bestSellers: ReadonlySet<string>,
  now: Date
): CardBadge | null {
  if (settings.manual_enabled) {
    const text = storedBadgeOf(product.product_extension?.badge)
    if (text !== null) {
      return { kind: "manual", text }
    }
  }
  if (settings.best_seller_enabled && bestSellers.has(product.id)) {
    return { kind: "best_seller" }
  }
  if (settings.new_enabled && isNewProduct(product.created_at, settings.new_days, now)) {
    return { kind: "new" }
  }
  return null
}

/** The shop's badge settings (from the settings' cache). */
export async function badgeSettings(container: Container): Promise<ProductBadgeSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("product_badges")) as unknown as ProductBadgeSettings
}

/**
 * The badges of a page of cards, by product id (only those with one). The
 * best sellers are one held read for the whole shop, made only while
 * "Çok satan" is on.
 */
export async function cardBadges(
  container: Container,
  products: readonly BadgeProduct[],
  settings: ProductBadgeSettings,
  now: Date = new Date()
): Promise<Map<string, CardBadge>> {
  const found = new Map<string, CardBadge>()
  if (!anyBadgeOn(settings) || products.length === 0) {
    return found
  }
  const bestSellers: ReadonlySet<string> = settings.best_seller_enabled
    ? await soldAtLeastIds(container, BEST_SELLER_DAYS, settings.best_seller_min_units, now)
    : new Set<string>()
  for (const product of products) {
    const badge = badgeOf(product, settings, bestSellers, now)
    if (badge) {
      found.set(product.id, badge)
    }
  }
  return found
}
