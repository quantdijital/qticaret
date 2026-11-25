import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { AI_KEY, aiServicesQuery } from "@/features/ai/api/ai"
import { postAi } from "@/features/ai/api/suggestions"
import { sdk } from "@/lib/sdk"

/**
 * The platform's AI credits (adr/0085 §3, §5) as the backend answers them
 * (`api/admin/ai/credits`): the wallet, the day's cap, what each task
 * costs, the packs and the open top-up request. Every number is the
 * server's, shown as it comes: the panel works out no credit and no
 * price, and sends only a pack's id. The flag off, the answer is
 * `{ available: false }` and the panel shows nothing of the credits.
 */

const count = z.number().int().min(0)

const packSchema = z.object({
  id: z.string(),
  name: z.string(),
  credits: count,
  /** Minor units (kuruş), the control plane's price. */
  amount: count,
  currency: z.string(),
})
export type AiCreditPackView = z.infer<typeof packSchema>

const orderSchema = z.object({
  id: z.string(),
  pack_id: z.string(),
  credits: count,
  amount: count,
  currency: z.string(),
  status: z.string(),
  requested_at: z.string(),
})
export type AiCreditOrderView = z.infer<typeof orderSchema>

export const aiCreditsSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }),
  z.object({
    available: z.literal(true),
    plan: z.object({ remaining: count, renews_on: z.string() }),
    purchased: z.object({ remaining: count, expires_on: z.string().nullable() }),
    daily: z.object({ cap: count, remaining: count }),
    tasks: z.record(z.string(), count),
    packs: z.array(packSchema),
    pending_order: orderSchema.nullable(),
  }),
])
export type AiCreditsAnswer = z.infer<typeof aiCreditsSchema>
export type AiCreditsWallet = Extract<AiCreditsAnswer, { available: true }>

export const AI_CREDITS_KEY = [...AI_KEY, "credits"] as const

/** The platform's credits as a service (`GET /admin/ai/services`); "Platform kredisi". */
export const PLATFORM_SERVICE = "platform"

/** Who reads the wallet (`GET /admin/ai/credits`: owner, admin); others never ask. */
export const mayReadCredits = (role: string | null | undefined): boolean =>
  role === "owner" || role === "admin"

/** Short-lived and read again on focus: a wallet is not kept long (#376 review). */
export const aiCreditsQuery = () =>
  queryOptions({
    queryKey: AI_CREDITS_KEY,
    queryFn: async () => aiCreditsSchema.parse(await sdk.client.fetch("/admin/ai/credits")),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

/**
 * A top-up request: the pack's id alone. A failure keeps the backend's key
 * (`ai.credits_order_open`, `ai.credits_pack_unknown`) in `code`; done,
 * the wallet and the services are read again.
 */
export function useRequestCreditTopUp() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (packId: string) => {
      const answer = (await postAi("/admin/ai/credits/orders", { pack_id: packId })) as {
        order?: unknown
      } | null
      return orderSchema.parse(answer?.order)
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: AI_CREDITS_KEY }),
        client.invalidateQueries({ queryKey: aiServicesQuery().queryKey }),
      ]),
    // A request already open, a pack gone: the wallet as it stands now
    onError: () => client.invalidateQueries({ queryKey: AI_CREDITS_KEY }),
  })
}

/** Money in minor units as the shop's locale writes it (`25000`, TRY → "₺250,00"); no sum. */
export function formatMinorMoney(amount: number, currency: string): string {
  const format = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency.toUpperCase(),
  })
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2
  return format.format(amount / 10 ** digits)
}
