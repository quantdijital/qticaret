import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeAppleAccount, startFakeApple } from "@qticaret/testing"
import type { FakeApple } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { eraseCustomer } from "../../src/workflows/legal/erasure/customer"
import { attachGuestOrdersWorkflow } from "../../src/workflows/orders/attach-guest-orders"
import { confirmEmail, registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { namedPort } from "../helpers/port"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

// The auth providers are read when the app starts, before any hook
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

/**
 * Security review of PR #73: what proves an address, beyond guest orders
 * (guest-orders-proof.spec.ts). A code another identity confirmed for the
 * address proves nothing and joins no social sign-in to the account (M1);
 * a social address proves in any case (L2); an erased customer leaves no
 * sign-in, login address or confirmation behind (L4a); the owner taking a
 * squatted login with the reset link does not inherit what was typed into
 * it (L4b).
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
      variantId = (await stockedProduct(getContainer(), shop, `kanit-${randomUUID()}`, 10, 100))
        .variantId
    })

    const bearer = (token: string) => ({ ...store.headers, authorization: `Bearer ${token}` })
    const auth = () => getContainer().resolve(Modules.AUTH)
    /** Address confirmations: Medusa's auth service lists them beyond its published types (2.21.2). */
    const verifications = (filters: Record<string, unknown>) =>
      (
        auth() as unknown as {
          listAuthVerifications: (
            filters: Record<string, unknown>
          ) => Promise<{ verified_at: Date | string | null }[]>
        }
      ).listAuthVerifications(filters)
    /** The identity a sign-in's token names. */
    const identityOf = (token: string) =>
      (
        JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
          auth_identity_id?: string
        }
      ).auth_identity_id ?? ""

    const guestOrder = (email: string) =>
      placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        email,
      })

    async function ownerOf(orderId: string): Promise<string | null> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["customer_id"], filters: { id: orderId } })
      return (data[0] as { customer_id?: string | null } | undefined)?.customer_id ?? null
    }

    /** Registered with the address and the account opened with these details, never confirmed. */
    async function unconfirmed(email: string, details: Record<string, string> = {}) {
      const registration = await http.post<{ token: string }>("/auth/customer/emailpass/register", {
        email,
        password: randomUUID(),
      })
      const token = registration.data.token
      const opened = await http.post<{ customer: { id: string } }>(
        "/store/customers",
        { email, first_name: "Saldırgan", ...details },
        { headers: bearer(token) }
      )
      return { id: opened.data.customer.id, token }
    }

    /** Apple's sign-in for the address, then `POST /store/customers` with its token. */
    async function signInWithApple(email: string) {
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
      return { token, opened }
    }

    /** The reset link's new password, as the address's owner sets it from the mailbox. */
    async function resetPassword(email: string) {
      const bus = getContainer().resolve(Modules.EVENT_BUS)
      const subscriberId = `reset-${randomUUID()}`
      let deliver: (token: string) => void = () => undefined
      const mailed = new Promise<string>((resolve) => {
        deliver = resolve
      })
      const listener = ({ data }: { data: unknown }) => {
        const event = data as { entity_id?: string; token?: string }
        if (event.entity_id === email && event.token) {
          deliver(event.token)
        }
        return Promise.resolve()
      }
      bus.subscribe("auth.password_reset", listener, { subscriberId })
      try {
        await http.post("/auth/customer/emailpass/reset-password", { identifier: email })
        const resetToken = await mailed
        const updated = await settle(
          http.post(
            "/auth/customer/emailpass/update",
            { password: randomUUID() },
            { headers: { authorization: `Bearer ${resetToken}` } }
          )
        )
        expect(updated.status).toBe(200)
      } finally {
        bus.unsubscribe("auth.password_reset", listener, { subscriberId })
      }
    }

    const readCustomer = async (id: string) =>
      (await getContainer().resolve(Modules.CUSTOMER).listCustomers({ id }, { take: 1 }))[0]

    it("counts no code another identity confirmed for the address (M1)", async () => {
      const email = `hedef-${randomUUID()}@example.com`
      const victims = await guestOrder(email)
      const intruder = await unconfirmed(email)
      // An accomplice's own login asks for and confirms a code for the address, in its session
      const accomplice = await http.post<{ token: string }>("/auth/customer/emailpass/register", {
        email: `suc-ortagi-${randomUUID()}@example.com`,
        password: randomUUID(),
      })
      await confirmEmail(http, getContainer(), accomplice.data.token, email)
      const [confirmed] = await verifications({ entity_id: email })
      expect(confirmed?.verified_at).not.toBeNull()

      const { result: moved } = await attachGuestOrdersWorkflow(getContainer()).run({
        input: { customer_id: intruder.id },
      })
      // The address's owner signs in with Apple: their sign-in joins no unconfirmed account
      const { token, opened } = await signInWithApple(email)
      const identity = await auth().retrieveAuthIdentity(identityOf(token))

      expect(moved).toBe(0)
      expect(await ownerOf(victims)).not.toBe(intruder.id)
      expect(opened.status).toBe(422)
      expect(identity.app_metadata?.["customer_id"]).not.toBe(intruder.id)
    })

    it("proves an address a social provider wrote in capitals (L2)", async () => {
      const email = `Buyuk.Harf-${randomUUID()}@PrivateRelay.example`
      const own = await guestOrder(email.toLowerCase())
      const { token, opened } = await signInWithApple(email)
      const refreshed = await http.post<TokenBody>(
        "/auth/token/refresh",
        {},
        { headers: bearer(token) }
      )
      const me = await settle(
        http.get("/store/customers/me", { headers: bearer(refreshed.data.token ?? "") })
      )

      expect(opened.status).toBe(200)
      expect(me.status).toBe(200)
      expect(await ownerOf(own)).toBe(opened.data.customer?.id)
    })

    it("leaves no sign-in, login address or confirmation of an erased customer (L4a)", async () => {
      const customer = await registerCustomer(http, store)
      // A changed password is kept on the identity: Medusa's removal then keeps the identity
      await resetPassword(customer.email)
      const [login] = await auth().listProviderIdentities({ entity_id: customer.email })
      const emailIdentity = login?.auth_identity_id ?? ""
      await eventually(
        () => auth().retrieveAuthIdentity(emailIdentity),
        (identity) => typeof identity.app_metadata?.["password_changed_at"] === "string"
      )
      // And an Apple sign-in joined to the account: a second identity
      const joined = await signInWithApple(customer.email)
      expect(joined.opened.data.customer?.id).toBe(customer.id)
      const appleIdentity = identityOf(joined.token)

      // Another customer, whose sign-in must survive the erasure
      const other = await registerCustomer(http, store)
      const [otherLogin] = await auth().listProviderIdentities({ entity_id: other.email })
      const otherIdentity = otherLogin?.auth_identity_id ?? ""
      // The filter the erasure reads by is applied in the database: one identity, not every one
      const byCustomer = await auth().listAuthIdentities(
        { app_metadata: { customer_id: other.id } },
        { take: null }
      )
      expect(byCustomer.map(({ id }) => id)).toEqual([otherIdentity])

      const confirmations = await verifications({ entity_id: customer.email })
      await eraseCustomer(getContainer(), customer.id)

      const [survivor] = await auth().listAuthIdentities({ id: [otherIdentity] }, { take: null })
      expect(survivor?.app_metadata?.["customer_id"]).toBe(other.id)
      expect(await auth().listProviderIdentities({ entity_id: other.email })).toHaveLength(1)
      expect(await verifications({ entity_id: other.email })).not.toEqual([])
      expect(confirmations.length).toBeGreaterThan(0)
      expect(
        await auth().listAuthIdentities({ id: [emailIdentity, appleIdentity] }, { take: null })
      ).toEqual([])
      expect(await auth().listProviderIdentities({ entity_id: customer.email })).toEqual([])
      expect(await verifications({ entity_id: customer.email })).toEqual([])
      const db = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const stored = JSON.stringify([
        await db.select("*").from("provider_identity"),
        await db.select("*").from("auth_identity"),
      ])
      expect(stored).not.toContain(customer.email)
    })

    it("clears what was typed into a squatted login once its owner resets it (L4b)", async () => {
      const email = `isgal-${randomUUID()}@example.com`
      const squatted = await unconfirmed(email, { last_name: "Kaya", phone: "+905321234567" })
      expect(await readCustomer(squatted.id)).toMatchObject({ phone: "+905321234567" })

      await resetPassword(email)
      const cleared = await eventually(
        () => readCustomer(squatted.id),
        (customer) => customer?.phone === null
      )

      expect(cleared).toMatchObject({
        email,
        first_name: null,
        last_name: null,
        phone: null,
      })
    })

    it("keeps a confirmed account's details when its owner resets the password (L4b)", async () => {
      const customer = await registerCustomer(http, store)
      await getContainer()
        .resolve(Modules.CUSTOMER)
        .updateCustomers(customer.id, { phone: "+905329876543" })

      await resetPassword(customer.email)
      const [login] = await auth().listProviderIdentities({ entity_id: customer.email })
      await eventually(
        () => auth().retrieveAuthIdentity(login?.auth_identity_id ?? ""),
        (identity) => typeof identity.app_metadata?.["password_changed_at"] === "string"
      )
      // The clearing runs after the note: give it the time it would take
      await new Promise((resolve) => setTimeout(resolve, 1_000))

      expect(await readCustomer(customer.id)).toMatchObject({
        first_name: "Test",
        phone: "+905329876543",
      })
    })
  },
})
