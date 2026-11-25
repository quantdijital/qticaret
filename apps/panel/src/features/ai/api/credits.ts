import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"
import { AI_KEY, aiServicesQuery } from "@/features/ai/api/ai"
import { postAi } from "@/features/ai/api/suggestions"
import { i18next } from "@/lib/i18n"
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
 * a short toast says so and the wallet and the services are read again.
 * The toast is the hook's own: a call's `onSuccess` would not run once the
 * dialog that sent it is gone (an AI button's layer closes with it).
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
    onSuccess: () => {
      toast.success(i18next.t("ai.credits.requested"))
      return Promise.all([
        client.invalidateQueries({ queryKey: AI_CREDITS_KEY }),
        client.invalidateQueries({ queryKey: aiServicesQuery().queryKey }),
      ])
    },
    // A request already open, a pack gone: the wallet as it stands now
    onError: () => client.invalidateQueries({ queryKey: AI_CREDITS_KEY }),
  })
}

/** The panel's language as a number format's locale: English as `en-US`, anything else Turkish. */
const moneyLocale = (language: string | undefined): string =>
  language?.startsWith("en") ? "en-US" : "tr-TR"

/**
 * Money in minor units as the panel's language writes it (`25000`, TRY →
 * "₺250,00" in Turkish, "TRY 250.00" in English); the currency is the
 * server's. No sum.
 */
export function formatMinorMoney(
  amount: number,
  currency: string,
  language: string | undefined = i18next.language
): string {
  const format = new Intl.NumberFormat(moneyLocale(language), {
    style: "currency",
    currency: currency.toUpperCase(),
  })
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2
  return format.format(amount / 10 ** digits)
}
