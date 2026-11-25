import type { AiCreditsWallet } from "@/features/ai/api/credits"

/** A pack as the server offers it: 500 credits for 250,00 TL (in kuruş). */
export const PACK = {
  id: "pack-500",
  name: "500 kredi <b>paketi</b>",
  credits: 500,
  amount: 25_000,
  currency: "TRY",
}

/** The wallet `GET /admin/ai/credits` answers while the credits are on; changed per test. */
export const wallet = (changes: Partial<AiCreditsWallet> = {}): AiCreditsWallet => ({
  available: true,
  plan: { remaining: 40, renews_on: "2026-12-01" },
  purchased: { remaining: 0, expires_on: null },
  daily: { cap: 300, remaining: 300 },
  tasks: { seo_title: 1, product_description: 2, image_scene: 40 },
  packs: [PACK],
  pending_order: null,
  ...changes,
})
