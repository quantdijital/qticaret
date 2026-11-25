import type { AiWallet } from "@/features/ai-credits/api/schemas"

/**
 * Whether the wallet's answer says the shop may not spend platform
 * credits (P3d): its plan's `ai.platform_credits` off, or the shop not
 * `active` (a restricted, suspended or closing shop is answered
 * `available: false` by the gateway, P3a). A control plane before P3d
 * says neither, and then nothing is claimed.
 */
export const creditsOff = (wallet: AiWallet) =>
  wallet.flag_on === false ||
  (wallet.tenant_status !== undefined && wallet.tenant_status !== "active")

/** The share of the month's grant still left, 0–100; null when there is no grant to show it against. */
export function grantLeftPercent(wallet: AiWallet): number | null {
  const total = wallet.monthly_grant
  if (total === undefined || total <= 0) {
    return null
  }
  const left = Math.min(Math.max(wallet.balance.plan.balance, 0), total)
  return Math.round((left / total) * 100)
}
