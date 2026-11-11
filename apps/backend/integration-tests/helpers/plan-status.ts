import type { MedusaContainer } from "@medusajs/framework/types"
import { createAdminUser } from "./admin"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"
import { readyCart } from "./paytr"
import { setPlanStatus } from "./plan-limits"
import { stockShop, stockedProduct } from "./stock"
import type { StockShop } from "./stock"
import { createStorefront } from "./storefront"
import type { Storefront } from "./storefront"
import { loadTrAddressFixture } from "./tr-address"

/** A refusal or an answer, as the plan status specs read them. */
export interface Answer {
  message?: string
  code?: string
  status?: string
  order?: { id: string }
}

export interface SellingShop {
  shop: StockShop
  storefront: Storefront
  variantId: string
  itemId: string
  productId: string
  admin: Awaited<ReturnType<typeof createAdminUser>>
  /** A new cart's bank transfer started through the Store API, as a shopper does. */
  startPayment: () => Promise<Step & { cartId: string }>
  /** A cart whose payment started, completed through the Store API. */
  complete: (cartId: string) => Promise<Step>
  /** Both: the payment's start, or the completion once it started. */
  checkout: () => Promise<Step>
}

export interface Step {
  status: number
  data: Answer
  retryAfter: string | undefined
}

/**
 * The demo shop selling one stocked product by bank transfer (adr/0029),
 * set up while the shop is still active: its settings are writes a
 * restricted shop no longer makes (adr/0061 Ek C15).
 */
export async function sellingShop(
  http: HttpClient,
  container: MedusaContainer
): Promise<SellingShop> {
  // The tables are emptied between tests, the plan state cache is not: active again first
  await setPlanStatus(container, "active")
  await loadTrAddressFixture(container)
  const shop = await stockShop(container)
  const storefront = await createStorefront(container)
  const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
  const admin = await createAdminUser(http, container)
  const saved = await settle(
    http.post<Answer>(
      "/admin/platform-settings/bank_transfer",
      {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR330006100519786457841326",
        deadline_hours: 24,
      },
      { headers: admin.headers }
    )
  )
  // A thrown axios error does not survive Jest's worker: its status and key do
  if (saved.status !== 200) {
    throw new Error(`bank transfer not set up: ${String(saved.status)} ${saved.data.message ?? ""}`)
  }
  const startPayment = async () => {
    const cartId = await readyCart(container, shop, cup.variantId)
    const session = await settle(
      http.post<Answer>(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: "pp_bank-transfer_bank-transfer" },
        { headers: storefront.headers }
      )
    )
    return { cartId, ...stepOf(session) }
  }
  const complete = async (cartId: string) =>
    stepOf(
      await settle(
        http.post<Answer>(`/store/carts/${cartId}/complete`, {}, { headers: storefront.headers })
      )
    )
  const checkout = async () => {
    const started = await startPayment()
    return started.status === 200 ? await complete(started.cartId) : started
  }
  return { shop, storefront, ...cup, admin, startPayment, complete, checkout }
}

/** An answer as the specs read it: its status, body and `Retry-After`. */
function stepOf(answer: HttpResponse<Answer>): Step {
  const retryAfter = answer.headers["retry-after"]
  return {
    status: answer.status,
    data: answer.data,
    retryAfter: typeof retryAfter === "string" ? retryAfter : undefined,
  }
}
