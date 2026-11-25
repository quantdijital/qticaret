import type { AiWallet } from "@/features/ai-credits/api/schemas"
import { SHOP } from "@/test/shops"

/** The staff wallet route of the sample shop (`SHOP`). */
export const WALLET_PATH = `/admin/cp/tenants/${SHOP.tenant.id}/ai-credits`

/**
 * A wallet as the control plane answers it since P3d: the shop's flag on,
 * the shop active, its month's whole grant, and each ledger row's actor
 * named when a staff member wrote it.
 */
export const WALLET: AiWallet = {
  balance: {
    plan: { balance: 120, period: "2026-11", renewsOn: "2026-12-01" },
    purchased: { balance: 1500, expiresAt: "2027-11-20T21:00:00.000Z" },
    daily: { cap: 300, spent: 45, remaining: 255 },
  },
  own_daily_cap: null,
  flag_on: true,
  tenant_status: "active",
  monthly_grant: 300,
  entries: [
    {
      id: "ent_1",
      kind: "adjust",
      amount: 500,
      bucket: "purchased",
      note: "Kampanya telafisi",
      actor: "user_me",
      actor_name: "Deniz Kaya",
      created_at: "2026-11-20T10:00:00.000Z",
    },
    {
      id: "ent_2",
      kind: "spend",
      amount: -3,
      bucket: "plan",
      note: null,
      actor: "system",
      actor_name: null,
      created_at: "2026-11-21T10:00:00.000Z",
    },
  ],
  count: 2,
  limit: 20,
  offset: 0,
}
