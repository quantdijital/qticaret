import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { HttpClient } from "./http"
import type { Storefront } from "./storefront"

export interface TestCustomer {
  id: string
  email: string
  password: string
  /** Store API headers: publishable key plus the customer's bearer token. */
  headers: Record<string, string>
}

interface TokenResponse {
  token: string
}

/**
 * Confirms the address the way a shopper does (adr/0037 §1): asks Medusa
 * for a code, reads it where the mailbox would, sends it back. The code
 * comes from the event the e-mail is made from, so no mail server is needed.
 */
export async function confirmEmail(
  http: HttpClient,
  container: MedusaContainer,
  token: string,
  email: string
): Promise<void> {
  const bus = container.resolve(Modules.EVENT_BUS)
  const subscriberId = `test-verify-${randomUUID()}`
  let deliver: (code: string) => void = () => undefined
  const received = new Promise<string>((resolve) => {
    deliver = resolve
  })
  const listener = ({ data }: { data: unknown }) => {
    const event = data as { entity_id?: string; code?: string }
    if (event.entity_id === email && event.code) {
      deliver(event.code)
    }
    return Promise.resolve()
  }
  bus.subscribe("auth.verification_requested", listener, { subscriberId })
  try {
    await http.post(
      "/auth/verification/request",
      { entity_id: email, entity_type: "email" },
      { headers: { authorization: `Bearer ${token}` } }
    )
    const code = await Promise.race([
      received,
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(new Error("no verification code arrived"))
        }, 10_000)
      ),
    ])
    await http.post("/auth/verification/confirm", { code })
  } finally {
    bus.unsubscribe("auth.verification_requested", listener, { subscriberId })
  }
}

/** Registers a customer through the auth and Store APIs, confirms the address and logs in. */
export async function registerCustomer(
  http: HttpClient,
  storefront: Storefront
): Promise<TestCustomer> {
  const email = `customer-${randomUUID()}@example.com`
  // Throwaway credential for this test database only
  const password = randomUUID()

  const registration = await http.post<TokenResponse>("/auth/customer/emailpass/register", {
    email,
    password,
  })
  const { data } = await http.post<{ customer: { id: string } }>(
    "/store/customers",
    { email, first_name: "Test", last_name: "Müşteri" },
    {
      headers: {
        ...storefront.headers,
        authorization: `Bearer ${registration.data.token}`,
      },
    }
  )

  await confirmEmail(http, storefront.container, registration.data.token, email)
  const login = await http.post<TokenResponse>("/auth/customer/emailpass", { email, password })
  return {
    id: data.customer.id,
    email,
    password,
    headers: { ...storefront.headers, authorization: `Bearer ${login.data.token}` },
  }
}
