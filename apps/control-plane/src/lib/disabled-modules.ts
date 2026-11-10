import { Modules } from "@medusajs/framework/utils"

/**
 * Medusa's commerce modules the control plane has no use for (adr/0061
 * §1.1, "disable denemesi"). `defineConfig` always adds the core modules;
 * they cannot be removed, only replaced or disabled, and a disabled module
 * is neither loaded nor migrated. The route allowlist keeps every core
 * route unreachable either way.
 *
 * Kept, as Medusa needs them:
 * - sales_channel, store, pricing: the server's start runs Medusa's
 *   defaults workflow (a default sales channel and store, the store's price
 *   preferences) and stops without them (tried, 2.21.2)
 * - auth, user (staff), api_key (Medusa's admin authentication resolves it),
 *   notification and file (staff mail, exports later), and the
 *   infrastructure (cache, caching, event bus, workflows, locking, search,
 *   settings, links)
 *
 * Medusa's own migration scripts fix commerce data (cart currency codes,
 * product options, tax regions…) and fail without these tables:
 * `db:migrate` runs with `--skip-scripts` (package.json).
 */
export const DISABLED_MODULES = [
  [Modules.PRODUCT, "product"],
  [Modules.PROMOTION, "promotion"],
  [Modules.CUSTOMER, "customer"],
  [Modules.CART, "cart"],
  [Modules.REGION, "region"],
  [Modules.TAX, "tax"],
  [Modules.CURRENCY, "currency"],
  [Modules.PAYMENT, "payment"],
  [Modules.ORDER, "order"],
  [Modules.FULFILLMENT, "fulfillment"],
  [Modules.INVENTORY, "inventory"],
  [Modules.STOCK_LOCATION, "stock-location"],
] as const

export const disabledModules = () =>
  DISABLED_MODULES.map(([key, path]) => ({
    key,
    resolve: `@medusajs/medusa/${path}`,
    disable: true,
  }))
