import { randomUUID } from "node:crypto"
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

/** Registers a customer through the auth and Store APIs and logs in. */
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

  const login = await http.post<TokenResponse>("/auth/customer/emailpass", { email, password })
  return {
    id: data.customer.id,
    email,
    password,
    headers: { ...storefront.headers, authorization: `Bearer ${login.data.token}` },
  }
}
