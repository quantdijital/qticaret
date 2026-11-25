import type { TenantDetail } from "@/features/tenants/api"

/** The platform flag that turns the credits on for a shop (adr/0085, P1). */
export const AI_CREDITS_FLAG = "ai.platform_credits"

/** The package's monthly grant (adr/0085 K5), a limit key. */
export const AI_GRANT_LIMIT = "ai_free_credits_per_month"

/**
 * Whether the shop may spend platform credits at all: its flag on and the
 * shop `active` (a restricted, suspended or closing shop is answered
 * `available: false` by the gateway, P3a).
 */
export const creditsOn = (shop: TenantDetail) =>
  shop.tenant.status === "active" &&
  shop.features.some((flag) => flag.key === AI_CREDITS_FLAG && flag.value)

/** The shop's monthly grant as its package and exceptions set it; 0 when none. */
export const monthlyGrantOf = (shop: TenantDetail) =>
  shop.limits.find((limit) => limit.key === AI_GRANT_LIMIT)?.value ?? 0
