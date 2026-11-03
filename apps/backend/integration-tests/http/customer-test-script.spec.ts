import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createTestCustomer } from "../../src/scripts/test-customer/create"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

/**
 * `customer:test` (docs/09): a customer made from the command line signs in
 * through the storefront's own route at once, the address confirmed as the
 * verification flow confirms it; run again, only the password changes.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    // Made up per run; this test database only
    const firstPassword = `Deneme-${randomUUID()}`
    const secondPassword = `Yeni-${randomUUID()}`

    const login = (email: string, password: string) =>
      settle(
        http.post<{ token?: string; message?: string }>("/auth/customer/emailpass", {
          email,
          password,
        })
      )

    it("makes a verified customer who signs in, and sets the password again on a second run", async () => {
      const container = getContainer()
      const storefront = await createStorefront(container)
      const email = `test-${randomUUID().slice(0, 8)}@example.com`

      const first = await createTestCustomer(container, { email, password: firstPassword })
      expect(first.created).toBe(true)

      const signedIn = await login(email, firstPassword)
      expect(signedIn.status).toBe(200)
      const me = await http.get<{ customer: { id: string; email: string; has_account: boolean } }>(
        "/store/customers/me",
        { headers: { ...storefront.headers, authorization: `Bearer ${signedIn.data.token ?? ""}` } }
      )
      expect(me.data.customer).toMatchObject({ id: first.customer_id, email, has_account: true })

      const second = await createTestCustomer(container, { email, password: secondPassword })
      expect(second).toEqual({ customer_id: first.customer_id, created: false })
      expect((await login(email, firstPassword)).status).toBe(401)
      expect((await login(email, secondPassword)).status).toBe(200)
    })
  },
})
