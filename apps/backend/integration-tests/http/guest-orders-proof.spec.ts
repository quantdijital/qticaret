import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeAppleAccount, startFakeApple } from "@qticaret/testing"
import type { FakeApple } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { attachGuestOrdersWorkflow } from "../../src/workflows/orders/attach-guest-orders"
import { confirmEmail } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { namedPort } from "../helpers/port"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

// The auth providers are read when the app starts, before any hook: the
// fake Apple's address and client are set here, its server started later
const apple = fakeAppleAccount()
const port = namedPort()
Object.assign(process.env, {
  APPLE_AUTH_CLIENT_ID: apple.clientId,
  APPLE_AUTH_TEAM_ID: apple.teamId,
  APPLE_AUTH_KEY_ID: apple.keyId,
  APPLE_AUTH_PRIVATE_KEY: apple.privateKey.replace(/\n/g, "\\n"),
  APPLE_AUTH_CALLBACK_URL: "https://magaza.example.com/hesap/giris/apple",
  APPLE_AUTH_BASE_URL: `http://127.0.0.1:${String(port)}`,
})

interface TokenBody {
  token?: string
  location?: string
}

interface OrdersBody {
  orders?: { id: string }[]
}

/**
 * Security review of PR #73 (adr/0037 §1): a guest's orders join an
 * account only once its holder has proven the address. An account
 * registered with a victim's address and never confirmed has
 * `has_account` too: it takes none of the victim's guest orders, and
 * reads none. The real confirmation, or a social provider vouching for
 * the address, takes them on the next read.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fakeApple: FakeApple
    let shop: StockShop
    let store: Storefront
    let variantId: string

    beforeAll(async () => {
      fakeApple = await startFakeApple(apple, { port })
    })

    afterAll(async () => {
      await fakeApple.close()
    })

    beforeEach(async () => {
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, `misafir-${randomUUID()}`, 10, 100))
        .variantId
    })

    const guestOrder = (email: string) =>
      placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        email,
      })

    const bearer = (token: string) => ({ ...store.headers, authorization: `Bearer ${token}` })

    async function ownerOf(orderId: string): Promise<string | null> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["customer_id"], filters: { id: orderId } })
      return (data[0] as { customer_id?: string | null } | undefined)?.customer_id ?? null
    }

    /** Registered with the address, the account opened, its address never confirmed. */
    async function unconfirmed(email: string) {
      const password = randomUUID()
      const registration = await http.post<{ token: string }>("/auth/customer/emailpass/register", {
        email,
        password,
      })
      const token = registration.data.token
      const opened = await settle(
        http.post<{ customer: { id: string } }>(
          "/store/customers",
          { email, first_name: "Saldırgan" },
          { headers: bearer(token) }
        )
      )
      expect(opened.status).toBe(200)
      const refreshed = await settle(
        http.post<TokenBody>("/auth/token/refresh", {}, { headers: bearer(token) })
      )
      return {
        id: opened.data.customer.id,
        password,
        registrationToken: token,
        headers: bearer(refreshed.data.token ?? token),
      }
    }

    const readMe = (headers: Record<string, string>) =>
      settle(http.get("/store/customers/me", { headers }))
    const listOrders = (headers: Record<string, string>) =>
      settle(http.get<OrdersBody>("/store/orders", { headers }))
    const readOrder = (orderId: string, headers: Record<string, string>) =>
      settle(http.get(`/store/orders/${orderId}`, { headers }))

    it("gives an unconfirmed registration no session: Medusa's own gate (adr/0037 §1)", async () => {
      const email = `kok-${randomUUID()}@example.com`
      const victims = await guestOrder(email)
      const intruder = await unconfirmed(email)

      // The refreshed registration token still names no customer
      expect((await readMe(intruder.headers)).status).toBe(401)
      expect((await listOrders(intruder.headers)).status).toBe(401)
      expect((await readOrder(victims, intruder.headers)).status).toBe(404)
      expect(await ownerOf(victims)).not.toBe(intruder.id)
    })

    it("attaches no guest order to an account that never proved its address (a)", async () => {
      const email = `kurban-${randomUUID()}@example.com`
      const victims = await guestOrder(email)
      const guest = await ownerOf(victims)
      const intruder = await unconfirmed(email)

      // The reads that attach, with whatever token the intruder holds
      await readMe(intruder.headers)
      await listOrders(intruder.headers)
      // And the attachment itself, run for the account as a signed-in read would
      const { result: moved } = await attachGuestOrdersWorkflow(getContainer()).run({
        input: { customer_id: intruder.id },
      })

      expect(moved).toBe(0)
      expect(await ownerOf(victims)).toBe(guest)
      const listed = await listOrders(intruder.headers)
      expect(listed.data.orders?.map(({ id }) => id) ?? []).not.toContain(victims)
      expect((await readOrder(victims, intruder.headers)).status).toBe(404)
    })

    it("attaches them on the first read after the address is really confirmed (b)", async () => {
      const email = `gercek_${randomUUID()}@example.com`
      const own = await guestOrder(email)
      // `_` is a wildcard to ILIKE: a look-alike address's order stays its own
      const other = await guestOrder(email.replace("_", "x"))
      const owner = await unconfirmed(email)
      await readMe(owner.headers)
      expect(await ownerOf(own)).not.toBe(owner.id)

      await confirmEmail(http, getContainer(), owner.registrationToken, email)
      const login = await http.post<TokenBody>("/auth/customer/emailpass", {
        email,
        password: owner.password,
      })
      const headers = bearer(login.data.token ?? "")
      const listed = await listOrders(headers)

      expect(listed.status).toBe(200)
      expect(listed.data.orders?.map(({ id }) => id)).toContain(own)
      expect(listed.data.orders?.map(({ id }) => id)).not.toContain(other)
      expect(await ownerOf(own)).toBe(owner.id)
      expect((await readOrder(own, headers)).status).toBe(200)
    })

    it("attaches them for a social sign-in whose provider vouched for the address (c)", async () => {
      const email = `apple-${randomUUID()}@privaterelay.example`
      const own = await guestOrder(email)
      const start = await http.post<TokenBody>("/auth/customer/apple", {})
      const location = new URL(start.data.location ?? "https://none.example")
      const code = fakeApple.issue({
        sub: `001234.${randomUUID()}`,
        email,
        nonce: location.searchParams.get("nonce") ?? "",
      })
      const callback = await http.post<TokenBody>("/auth/customer/apple/callback", {
        code,
        state: location.searchParams.get("state") ?? "",
        user: JSON.stringify({ name: { firstName: "Ayşe", lastName: "Yılmaz" } }),
      })
      const token = callback.data.token ?? ""
      const opened = await settle(
        http.post<{ customer?: { id: string } }>(
          "/store/customers",
          { first_name: "Ayşe" },
          { headers: bearer(token) }
        )
      )
      const refreshed = await http.post<TokenBody>(
        "/auth/token/refresh",
        {},
        { headers: bearer(token) }
      )
      const headers = bearer(refreshed.data.token ?? "")

      expect(opened.status).toBe(200)
      expect((await readMe(headers)).status).toBe(200)
      expect(await ownerOf(own)).toBe(opened.data.customer?.id)
      expect((await listOrders(headers)).data.orders?.map(({ id }) => id)).toContain(own)
    })
  },
})
