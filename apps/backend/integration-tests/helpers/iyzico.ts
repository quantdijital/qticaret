import type { MedusaContainer } from "@medusajs/framework/types"
import type { IyzicoAccount } from "@qticaret/testing"
import { IYZICO_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { callbackSignature } from "../../src/lib/payments/iyzico"
import { createAdminUser } from "./admin"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { storeReturnUrls } from "./paytr"

/** Connects a sandbox iyzico account as the shop does from the panel; the admin's headers. */
export async function connectIyzico(
  http: HttpClient,
  container: MedusaContainer,
  account: IyzicoAccount
): Promise<{ headers: Record<string, string> }> {
  const admin = await createAdminUser(http, container)
  const saved = await settle(
    http.post(
      "/admin/integrations/credentials/iyzico",
      {
        settings: { test_mode: true },
        secrets: { api_key: account.apiKey, secret_key: account.secretKey },
      },
      { headers: admin.headers }
    )
  )
  if (saved.status !== 200) {
    throw new Error(`connecting iyzico answered ${String(saved.status)}`)
  }
  return admin
}

export interface StartedForm {
  sessionId: string
  token: string
  data: Record<string, unknown>
}

/** Opens an iyzico form for the cart as a storefront does. */
export async function startIyzicoPayment(
  http: HttpClient,
  headers: Record<string, string>,
  cartId: string
): Promise<StartedForm> {
  const started = await http.post<{
    payment_session: { id: string; data: Record<string, unknown> }
  }>(
    `/store/carts/${cartId}/payment-session`,
    { provider_id: IYZICO_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
    { headers }
  )
  const { id, data } = started.data.payment_session
  return { sessionId: id, token: String(data["token"]), data }
}

/**
 * The shopper's browser coming back from the form: the token as a form
 * post to the signed address the form was given, no redirect followed.
 * `secretKey` signs another session's address, as only we could.
 */
export const postIyzicoCallback = (
  baseUrl: string,
  sessionId: string,
  token: string,
  secretKey: string
) =>
  fetch(
    `${baseUrl}/hooks/iyzico/callback?session=${encodeURIComponent(sessionId)}&sig=${callbackSignature(secretKey, sessionId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      redirect: "manual",
    }
  )
