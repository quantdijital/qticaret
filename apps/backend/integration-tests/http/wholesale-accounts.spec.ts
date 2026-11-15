import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import {
  accountApi,
  accountRecords,
  groupsOf,
  tierRecords,
  wholesaleApi,
} from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface StoreProduct {
  product: { variants: { calculated_price: { calculated_amount: number } }[] }
}

interface StoreCart {
  cart: { id: string; items: { unit_price: number }[] }
}

const message = (answer: { data: unknown }) => (answer.data as { message?: string }).message

/**
 * ADR-0068 slice 1b: wholesalers opened, changed, closed and reopened by
 * the owner and admin. A registered address is a wholesaler at once; any
 * other waits on its invitation. Closed, the wholesaler pays retail on
 * the next request and their open cart is priced again. Retail is 100 TL;
 * the level sells at 80.00 (66.67 net).
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
    })

    const fresh = () => `toptan-${randomUUID()}@example.com`

    async function level(handle: string) {
      // On the shelf: a cart takes a tracked variant only with stock at the channel's warehouse
      const product = await stockedProduct(getContainer(), shop, handle, 50, 100)
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
      expect(answer.status).toBe(200)
      return answer.data.product.variants[0]?.calculated_price.calculated_amount
    }

    /** The customer's cart with one unit; status and body only reach an assertion. */
    async function cartWith(customer: TestCustomer, variantId: string) {
      const made = await settle(
        http.post<StoreCart>(
          "/store/carts",
          { region_id: shop.regionId },
          { headers: customer.headers }
        )
      )
      expect({ status: made.status, data: made.status === 200 ? null : made.data }).toEqual({
        status: 200,
        data: null,
      })
      const cartId = made.data.cart.id
      const added = await settle(
        http.post(
          `/store/carts/${cartId}/line-items`,
          { variant_id: variantId, quantity: 1 },
          { headers: customer.headers }
        )
      )
      expect({ status: added.status, data: added.status === 200 ? null : added.data }).toEqual({
        status: 200,
        data: null,
      })
      return cartId
    }

    async function cartPrice(customer: TestCustomer, cartId: string) {
      const read = await settle(
        http.get<StoreCart>(`/store/carts/${cartId}`, { headers: customer.headers })
      )
      expect(read.status).toBe(200)
      return read.data.cart.items[0]?.unit_price
    }

    it("answers as missing while the flag is off", async () => {
      expect((await accounts.list()).status).toBe(404)
      expect(
        (await accounts.create({ email: fresh(), contact_name: "Ali Kaya", own_prices: true }))
          .status
      ).toBe(404)
    })

    it("lets only the owner and admin reach wholesalers", async () => {
      await staff.flag(true)
      for (const role of ["operations", "readonly"] as const) {
        const other = accountApi(http, (await createAdminUser(http, getContainer(), role)).headers)
        expect({ role, status: (await other.list()).status }).toEqual({ role, status: 403 })
        const made = await other.create({ email: fresh(), contact_name: "Ali", own_prices: true })
        expect({ role, status: made.status }).toEqual({ role, status: 403 })
      }
      const admin = accountApi(http, (await createAdminUser(http, getContainer(), "admin")).headers)
      expect((await admin.list()).status).toBe(200)
    })

    it("makes a registered customer a wholesaler at once, in the level's group", async () => {
      await staff.flag(true)
      const { productId, tier } = await level("hemen")
      const customer = await registerCustomer(http, store)
      const made = await accounts.create({
        email: customer.email.toUpperCase(),
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak Ltd",
        tax_office: "Kadıköy",
        tax_id: "1234567890",
        tier_id: tier.id,
      })
      expect(made.status).toBe(201)
      expect(made.data).toMatchObject({
        account: {
          status: "active",
          email: customer.email,
          company_name: "Kaya Bıçak Ltd",
          customer: { id: customer.id },
          tier: { id: tier.id },
          own_prices: false,
        },
        billing_profile: "written",
      })
      // The address it was opened for is the customer's now: the account keeps none
      expect((await accountRecords(getContainer(), made.data.account.id)).email).toBeNull()
      const { groupId } = await tierRecords(getContainer(), tier.id)
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
      expect(await priceFor(productId, customer.headers)).toBe(80)
      expect(await priceFor(productId, store.headers)).toBe(100)
    })

    it("keeps one account per registered customer, whatever the address's case", async () => {
      await staff.flag(true)
      const customer = await registerCustomer(http, store)
      await accounts.made({ email: customer.email, contact_name: "Ali Kaya", own_prices: true })
      const again = await accounts.create({
        email: customer.email.toUpperCase(),
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      expect([again.status, message(again)]).toEqual([409, "wholesale.exists"])
    })

    it("invites an address with no account, pending, its invitation good for 90 days", async () => {
      await staff.flag(true)
      const email = fresh()
      const made = await accounts.create({
        email,
        contact_name: "Ayşe Yılmaz",
        company_name: "Yılmaz Ticaret",
        tax_office: "Kadıköy",
        tax_id: "1234567890",
        own_prices: true,
        min_quantity: 12,
      })
      expect(made.status).toBe(201)
      expect(made.data).toMatchObject({
        account: {
          status: "pending",
          email,
          company_name: "Yılmaz Ticaret",
          contact_name: "Ayşe Yılmaz",
          customer: null,
          own_prices: true,
          min_quantity: 12,
        },
        // Not kept for a pending wholesaler: they enter it on the storefront
        billing_profile: "none",
      })
      const days =
        (new Date(made.data.account.invitation_expires_at ?? 0).getTime() - Date.now()) / 86_400_000
      expect(Math.round(days)).toBe(90)
      const again = await accounts.create({ email, contact_name: "Ayşe", own_prices: true })
      expect([again.status, message(again)]).toEqual([409, "wholesale.exists"])
    })

    it("finds wholesalers on the list by company and by state", async () => {
      await staff.flag(true)
      const made = await accounts.made({
        email: fresh(),
        contact_name: "Ayşe Yılmaz",
        company_name: "Yılmaz Ticaret",
        own_prices: true,
      })
      const listed = await accounts.list(`q=${encodeURIComponent("yılmaz")}&status=pending`)
      expect(listed.status).toBe(200)
      expect(listed.data.accounts.map((account) => account.id)).toContain(made.id)
      const active = await accounts.list("status=active")
      expect(active.data.accounts.map((account) => account.id)).not.toContain(made.id)
    })

    /** A level's wholesaler with one unit in their cart at 80. */
    async function wholesalerWithCart(handle: string) {
      const { productId, variantId, tier } = await level(handle)
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      const cartId = await cartWith(customer, variantId)
      expect(await cartPrice(customer, cartId)).toBe(80)
      return { productId, customer, account, cartId }
    }

    it("closes a wholesaler to retail at once, their open cart too", async () => {
      await staff.flag(true)
      const { productId, customer, account, cartId } = await wholesalerWithCart("kapat")

      const closed = await accounts.action(account.id, "deactivate")
      expect(closed.status).toBe(200)
      expect(closed.data.account.status).toBe("inactive")
      expect(await groupsOf(getContainer(), customer.id)).toEqual([])
      expect(await priceFor(productId, customer.headers)).toBe(100)
      expect(await cartPrice(customer, cartId)).toBe(100)
      // Closed twice is refused
      const twice = await accounts.action(account.id, "deactivate")
      expect([twice.status, message(twice)]).toEqual([409, "wholesale.account_not_active"])
    })

    it("reopens a closed wholesaler at wholesale, their open cart too", async () => {
      await staff.flag(true)
      const { productId, customer, account, cartId } = await wholesalerWithCart("yeniden")
      expect((await accounts.action(account.id, "deactivate")).status).toBe(200)
      expect(await cartPrice(customer, cartId)).toBe(100)

      const reopened = await accounts.action(account.id, "reactivate")
      expect(reopened.status).toBe(200)
      expect(reopened.data.account.status).toBe("active")
      expect(await priceFor(productId, customer.headers)).toBe(80)
      expect(await cartPrice(customer, cartId)).toBe(80)
    })

    it("moves a wholesaler to another level, and refuses leaving them with no price", async () => {
      await staff.flag(true)
      const first = await level("seviye-bir")
      const second = await staff.tier({ name: "Toptan seviye-iki" })
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        tier_id: first.tier.id,
      })
      const moved = await accounts.update(account.id, { tier_id: second.id, min_quantity: 5 })
      expect(moved.data.account).toMatchObject({ tier: { id: second.id }, min_quantity: 5 })
      const { groupId } = await tierRecords(getContainer(), second.id)
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])

      const none = await accounts.update(account.id, { tier_id: null })
      expect([none.status, message(none)]).toEqual([409, "wholesale.no_price_source"])
    })
  },
})
