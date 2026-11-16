import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { WHOLESALE_MODULE } from "../../src/modules/wholesale"
import type WholesaleModuleService from "../../src/modules/wholesale/service"
import {
  accountApi,
  accountRecords,
  groupsOf,
  wholesaleApi,
  legacyPendingAccount,
} from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

/**
 * ADR-0068 §10: a customer's KVKK erasure takes their wholesale account
 * with it: out of the wholesale groups, their own list, its hand-entered
 * prices and hidden group deleted, the account cleared and closed. An
 * invitation pending to one of their addresses goes too.
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

    async function erase(customerId: string) {
      const request = await staff.post<{ privacy_request: { id: string } }>(
        `/admin/customers/${customerId}/privacy-requests`,
        { kind: "erasure", channel: "letter", received_at: new Date().toISOString() }
      )
      expect(request.status).toBe(200)
      const erased = await staff.post(
        `/admin/privacy-requests/${request.data.privacy_request.id}/erase`,
        {}
      )
      expect(erased.status).toBe(200)
    }

    it("erases a wholesaler's account, own list and group with the customer", async () => {
      const product = await stockedProduct(getContainer(), shop, "silme", null, 100)
      const tier = await staff.tier({ name: "Toptan silme" })
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak",
        tier_id: tier.id,
        own_prices: true,
      })
      await accounts.prices(account.id, { set: [{ variant_id: product.variantId, net: "50.00" }] })
      const own = await accountRecords(getContainer(), account.id)
      expect(own.priceListId).not.toBeNull()

      await erase(customer.id)

      expect(await accountRecords(getContainer(), account.id)).toMatchObject({
        deleted: true,
        email: null,
      })
      expect((await accounts.get(account.id)).status).toBe(404)
      const lists = await getContainer()
        .resolve(Modules.PRICING)
        .listPriceLists({ id: [own.priceListId ?? ""] })
      const groups = await getContainer()
        .resolve(Modules.CUSTOMER)
        .listCustomerGroups({ id: [own.groupId ?? ""] })
      expect({ lists: lists.length, groups: groups.length }).toEqual({ lists: 0, groups: 0 })
      expect(await groupsOf(getContainer(), customer.id)).toEqual([])
    })

    it("clears the company a deleted wholesaler's row kept, with the customer (review M1)", async () => {
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        company_name: "Ali Kaya",
        own_prices: true,
      })
      expect((await accounts.remove(account.id)).status).toBe(200)
      const service = getContainer().resolve<WholesaleModuleService>(WHOLESALE_MODULE)
      const kept = await service.listWholesaleAccounts(
        { id: account.id },
        { take: 1, withDeleted: true }
      )
      // A sole trader's company is a person's name: kept for the order list until erased
      expect(kept[0]?.company_name).toBe("Ali Kaya")

      await erase(customer.id)

      const [row] = await service.listWholesaleAccounts(
        { id: account.id },
        { take: 1, withDeleted: true }
      )
      expect(row).toMatchObject({
        company_name: null,
        customer_id: null,
        email: null,
        contact_name: null,
      })
      expect(row?.deleted_at).not.toBeNull()
    })

    it("takes an invitation pending to the erased customer's address too", async () => {
      // A guest record at the address (an order's), and a pending invitation to it
      const email = `kvkk-${randomUUID()}@example.com`
      const guest = await getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email, has_account: false })
      const pending = await legacyPendingAccount(getContainer(), {
        email,
        contact_name: "Ayşe Yılmaz",
        own_prices: true,
      })

      await erase(guest.id)

      expect(await accountRecords(getContainer(), pending.id)).toMatchObject({
        deleted: true,
        email: null,
      })
    })
  },
})
