import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { confirmEmail } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import {
  accountApi,
  groupsOf,
  legacyPendingAccount,
  testPassword,
  wholesaleApi,
} from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface StoreProduct {
  product: { variants: { calculated_price: { calculated_amount: number } }[] }
}

/**
 * Security review H1: an account registered with an address but never
 * confirmed has `has_account` too, and a refreshed token reads
 * `/store/customers/me`. It neither takes an invitation left from before
 * staff set passwords nor is made a wholesaler at once (Ek 2026-11-15
 * (2), case 3): staff are told, and only an explicit take-over binds the
 * address, its password replaced and the intruder's sign-ins ended; a code
 * asked for another address proves nothing; the real confirmation does.
 * Retail 100, the level 80.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let accounts: ReturnType<typeof accountApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      accounts = accountApi(http, admin.headers)
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      await staff.flag(true)
    })

    /** Registered with the address, the account opened, its address never confirmed. */
    async function unconfirmed(email: string) {
      const password = randomUUID()
      const registration = await settle(
        http.post<{ token: string }>("/auth/customer/emailpass/register", { email, password })
      )
      expect(registration.status).toBe(200)
      const token = registration.data.token
      const opened = await settle(
        http.post<{ customer: { id: string } }>(
          "/store/customers",
          { email, first_name: "Saldırgan" },
          { headers: { ...store.headers, authorization: `Bearer ${token}` } }
        )
      )
      expect(opened.status).toBe(200)
      // The registration token refreshed now names the customer
      const refreshed = await settle(
        http.post<{ token: string }>(
          "/auth/token/refresh",
          {},
          { headers: { authorization: `Bearer ${token}` } }
        )
      )
      expect(refreshed.status).toBe(200)
      return {
        id: opened.data.customer.id,
        password,
        registrationToken: token,
        headers: { ...store.headers, authorization: `Bearer ${refreshed.data.token}` },
      }
    }

    const readMe = (headers: Record<string, string>) =>
      settle(http.get("/store/customers/me", { headers }))

    async function level(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, 10, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "66.67" }] })
      return { ...product, tier }
    }

    async function priceFor(productId: string, headers: Record<string, string>) {
      const answer = await settle(
        http.get<StoreProduct>(
          `/store/products/${productId}?region_id=${shop.regionId}&fields=*variants.calculated_price`,
          { headers }
        )
      )
      return answer.status === 200
        ? answer.data.product.variants[0]?.calculated_price.calculated_amount
        : answer.status
    }

    it("lets no unconfirmed registration take an invitation (a)", async () => {
      const { productId, tier } = await level("dogrulanmamis")
      const email = `davet-${randomUUID()}@example.com`
      const invited = await legacyPendingAccount(getContainer(), {
        email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      const intruder = await unconfirmed(email)

      await readMe(intruder.headers)
      expect((await accounts.get(invited.id)).data.account.status).toBe("pending")
      expect(await groupsOf(getContainer(), intruder.id)).toEqual([])
      expect(await priceFor(productId, intruder.headers)).not.toBe(80)
    })

    it("refuses an unconfirmed sign-up's address until staff take it over (b)", async () => {
      const email = `acik-${randomUUID()}@example.com`
      const intruder = await unconfirmed(email)
      const body = {
        email,
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak",
        tax_office: "Kadıköy",
        tax_id: "1234567890",
        own_prices: true,
      }
      const refused = await accounts.create(body)
      expect([refused.status, (refused.data as { message?: string }).message]).toEqual([
        409,
        "wholesale.unproven_signup",
      ])
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "customer",
          fields: ["billing_profile.id"],
          filters: { id: intruder.id },
        })
      expect((data[0] as { billing_profile?: unknown } | undefined)?.billing_profile ?? null).toBe(
        null
      )
      expect(await groupsOf(getContainer(), intruder.id)).toEqual([])
    })

    it("takes an unconfirmed sign-up over: every sign-in ended, nothing it planted kept (b2)", async () => {
      const { productId, tier } = await level("devral")
      const email = `devral-${randomUUID()}@example.com`
      const intruder = await unconfirmed(email)
      // What the intruder planted on their record: an address the wholesaler must not inherit
      await getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomerAddresses([
          { customer_id: intruder.id, first_name: "Saldırgan", address_1: "Bilinmeyen Sk. 1" },
        ])
      // A second sign-in at the address in another case, where the provider keeps them apart (M2)
      const variant = email.replace(/^d/, "D")
      const second = await settle(
        http.post("/auth/customer/emailpass/register", {
          email: variant,
          password: intruder.password,
        })
      )
      const password = testPassword()
      const made = await accounts.create({
        email,
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak",
        tax_office: "Kadıköy",
        tax_id: "1234567890",
        tier_id: tier.id,
        password,
        take_over: true,
      })
      expect(made.status).toBe(201)
      expect(made.data).toMatchObject({ account: { status: "active" }, password: "replaced" })
      // A fresh customer for the wholesaler; the sign-up's record retired (M5)
      const customerId = made.data.account.customer?.id ?? ""
      expect(customerId).not.toBe(intruder.id)
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data: rows } = await query.graph({
        entity: "customer",
        fields: ["id", "has_account", "addresses.id", "billing_profile.legal_name"],
        filters: { id: [customerId, intruder.id] },
        withDeleted: true,
      })
      const byId = new Map(
        (
          rows as {
            id: string
            has_account: boolean
            addresses?: unknown[]
            billing_profile?: { legal_name?: string } | null
          }[]
        ).map((row) => [row.id, row])
      )
      expect(byId.get(customerId)).toMatchObject({
        has_account: true,
        addresses: [],
        billing_profile: { legal_name: "Kaya Bıçak" },
      })
      expect(byId.get(intruder.id)?.has_account).toBe(false)

      // Every sign-in from before the take-over is refused, not only a refresh
      expect((await readMe(intruder.headers)).status).toBe(401)
      expect(await priceFor(productId, intruder.headers)).toBe(401)
      for (const address of second.status === 200 ? [email, variant] : [email]) {
        const old = await settle(
          http.post("/auth/customer/emailpass", { email: address, password: intruder.password })
        )
        expect({ address, status: old.status }).toEqual({ address, status: 401 })
      }

      // The change is noted a second ahead (L6): a sign-in after it waits that second out
      await new Promise((resolve) => setTimeout(resolve, 2_100))
      const login = await settle(
        http.post<{ token: string }>("/auth/customer/emailpass", { email, password })
      )
      expect(login.status).toBe(200)
      const headers = { ...store.headers, authorization: `Bearer ${login.data.token}` }
      expect((await readMe(headers)).status).toBe(200)
      expect(await priceFor(productId, headers)).toBe(80)
      // The wholesaler's first cart starts with no address of the intruder's
      const cart = await settle(
        http.post<{ cart: { shipping_address: unknown } }>(
          "/store/carts",
          { region_id: shop.regionId },
          { headers }
        )
      )
      expect(cart.data.cart.shipping_address ?? null).toBeNull()
    })

    it("counts no code confirmed for another address (c)", async () => {
      const { tier } = await level("baska-adres")
      const email = `hedef-${randomUUID()}@example.com`
      const invited = await legacyPendingAccount(getContainer(), {
        email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      const intruder = await unconfirmed(email)
      // The intruder confirms an address of their own, in their own session
      const own = `kendi-${randomUUID()}@example.com`
      await confirmEmail(http, getContainer(), intruder.registrationToken, own)
      const [confirmed] = await getContainer()
        .resolve(Modules.AUTH)
        .listAuthVerifications({ entity_id: own }, { take: 1 })
      expect(confirmed?.verified_at).not.toBeNull()

      await readMe(intruder.headers)
      expect((await accounts.get(invited.id)).data.account.status).toBe("pending")
    })

    it("takes the invitation once the address is really confirmed (d)", async () => {
      const { productId, tier } = await level("dogrulanmis")
      const email = `gercek-${randomUUID()}@example.com`
      const invited = await legacyPendingAccount(getContainer(), {
        email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      const owner = await unconfirmed(email)
      await readMe(owner.headers)
      expect((await accounts.get(invited.id)).data.account.status).toBe("pending")

      await confirmEmail(http, getContainer(), owner.registrationToken, email)
      const login = await settle(
        http.post<{ token: string }>("/auth/customer/emailpass", {
          email,
          password: owner.password,
        })
      )
      expect(login.status).toBe(200)
      const headers = { ...store.headers, authorization: `Bearer ${login.data.token}` }
      expect((await readMe(headers)).status).toBe(200)
      expect((await accounts.get(invited.id)).data.account).toMatchObject({
        status: "active",
        customer: { id: owner.id },
      })
      expect(await priceFor(productId, headers)).toBe(80)
    })
  },
})
