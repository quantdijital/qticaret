import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { WHOLESALE_MODULE } from "../../src/modules/wholesale"
import type WholesaleModuleService from "../../src/modules/wholesale/service"
import { removeExpiredInvitations } from "../../src/workflows/wholesale/accounts/remove"
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

const DAY = 86_400_000

/**
 * ADR-0068 §3: an invited wholesaler signs up with the invited address and,
 * reading their own account, takes the pending account: no Store write
 * route, the proof `attachGuestOrders` takes. The customer's groups never
 * show on the Store API. Retail 100 TL, the level 80.00.
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

    async function invited(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, null, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "66.67" }] })
      const email = `davet-${randomUUID()}@example.com`
      const account = await accounts.made({
        email,
        contact_name: "Ayşe Nur Yılmaz",
        company_name: "Yılmaz Ticaret",
        tier_id: tier.id,
      })
      expect(account.status).toBe("pending")
      return { ...product, tier, email, account }
    }

    const me = (customer: TestCustomer, query = "") =>
      settle(
        http.get<{ customer: Record<string, unknown> }>(`/store/customers/me${query}`, {
          headers: customer.headers,
        })
      )

    async function priceFor(productId: string, headers: Record<string, string>) {
      const answer = await http.get<StoreProduct>(
        `/store/products/${productId}?region_id=${shop.regionId}&fields=*variants.calculated_price`,
        { headers }
      )
      return answer.data.product.variants[0]?.calculated_price.calculated_amount
    }

    it("binds the invitation to the customer who signs up with its address", async () => {
      const { productId, tier, email, account } = await invited("sahiplen")
      const customer = await registerCustomer(http, store, email)
      // Signed up but not yet read their account: still retail
      expect((await accounts.get(account.id)).data.account.status).toBe("pending")

      const answer = await me(customer)
      expect(answer.status).toBe(200)
      const claimed = (await accounts.get(account.id)).data.account
      expect(claimed).toMatchObject({
        status: "active",
        customer: { id: customer.id },
        email,
        // Handed to the customer record where blank; its own names stay
        company_name: "Yılmaz Ticaret",
      })
      expect((await accountRecords(getContainer(), account.id)).email).toBeNull()
      const { groupId } = await tierRecords(getContainer(), tier.id)
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
      expect(await priceFor(productId, customer.headers)).toBe(80)

      // Read again, nothing changes
      expect((await me(customer)).status).toBe(200)
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
    })

    it("never shows the customer's groups on the Store API", async () => {
      const { email } = await invited("gruplar")
      const customer = await registerCustomer(http, store, email)
      const plain = await me(customer)
      expect(plain.data.customer).not.toHaveProperty("groups")
      for (const fields of ["*groups", "groups.id", "+groups.name"]) {
        const asked = await me(customer, `?fields=${fields}`)
        expect(JSON.stringify(asked.data)).not.toContain("cusgroup_")
      }
      // Nor the wholesale account linked to them (review M3)
      for (const fields of ["+wholesale_account.*", "*wholesale_account", "wholesale_account.id"]) {
        const asked = await me(customer, `?fields=${encodeURIComponent(fields)}`)
        expect({ fields, status: asked.status }).toEqual({ fields, status: 400 })
        expect(JSON.stringify(asked.data)).not.toContain("wacc_")
      }
    })

    it("binds nothing to another address, nor while the flag is off", async () => {
      const { account, email } = await invited("baskasi")
      const stranger = await registerCustomer(http, store)
      await me(stranger)
      expect((await accounts.get(account.id)).data.account.status).toBe("pending")
      expect(await groupsOf(getContainer(), stranger.id)).toEqual([])

      await staff.flag(false)
      const owner = await registerCustomer(http, store, email)
      await me(owner)
      await staff.flag(true)
      expect((await accounts.get(account.id)).data.account.status).toBe("pending")
      // On again, the next read takes it
      await me(owner)
      expect((await accounts.get(account.id)).data.account.status).toBe("active")
    })

    it("lets an invitation past its 90 days go, unclaimed, with the address it held", async () => {
      const { account, email } = await invited("suresi")
      await getContainer()
        .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
        .updateWholesaleAccounts({ id: account.id, invited_at: new Date(Date.now() - 91 * DAY) })
      const customer = await registerCustomer(http, store, email)
      await me(customer)
      expect((await accounts.get(account.id)).data.account.status).toBe("pending")

      expect(await removeExpiredInvitations(getContainer())).toBeGreaterThanOrEqual(1)
      expect(await accountRecords(getContainer(), account.id)).toMatchObject({
        deleted: true,
        email: null,
      })
      expect((await accounts.get(account.id)).status).toBe(404)
    })
  },
})
