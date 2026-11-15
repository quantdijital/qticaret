import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { accountApi, accountRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

const message = (answer: { data: unknown }) => (answer.data as { message?: string }).message

/**
 * ADR-0068 §9 for wholesalers (slice 1b): the routes take the account's id
 * only, its hidden group and own list are the module's (read as missing,
 * written as `wholesale.managed` through Medusa's routes, left out of its
 * lists), and only a pending wholesaler is taken back, with its own list.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let accounts: ReturnType<typeof accountApi>
    let store: Storefront

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      accounts = accountApi(http, admin.headers)
      store = await createStorefront(getContainer())
      await staff.flag(true)
    })

    const fresh = () => `toptan-${randomUUID()}@example.com`

    it("takes the account's id only: its group and list are the module's and hidden", async () => {
      const tier = await staff.tier({ name: "Toptan idor" })
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      const { groupId, priceListId } = await accountRecords(getContainer(), account.id)
      expect(groupId).not.toBeNull()
      expect(JSON.stringify((await accounts.get(account.id)).data)).not.toContain(groupId ?? "-")

      // Another record's id, an unknown one, a Medusa id in the body
      expect((await accounts.get(tier.id)).status).toBe(404)
      expect((await accounts.get("wacc_01UNKNOWN")).status).toBe(404)
      const ruled = await accounts.update(account.id, { private_price_list_id: "plist_x" })
      expect(ruled.status).toBe(400)
      // A level-only wholesaler has no own prices to read or write
      const levelOnly = await accounts.made({
        email: fresh(),
        contact_name: "Veli Ak",
        tier_id: tier.id,
      })
      const lines = await accounts.lines(levelOnly.id)
      expect([lines.status, message(lines)]).toEqual([409, "wholesale.own_prices_off"])

      // Medusa's own routes: read as missing, written as the module's
      expect((await staff.get(`/admin/customer-groups/${groupId ?? ""}`)).status).toBe(404)
      expect((await staff.get(`/admin/price-lists/${priceListId ?? ""}`)).status).toBe(404)
      const other = await registerCustomer(http, store)
      const joined = await staff.post(`/admin/customer-groups/${groupId ?? ""}/customers`, {
        add: [other.id],
      })
      expect([joined.status, message(joined)]).toEqual([409, "wholesale.managed"])
      const listed = await staff.get<{ customer_groups: { id: string }[] }>(
        "/admin/customer-groups?limit=200"
      )
      expect(listed.data.customer_groups.map((group) => group.id)).not.toContain(groupId)
    })

    it("takes a pending wholesaler back with its own list, never an active one", async () => {
      const pending = await accounts.made({
        email: fresh(),
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      const before = await accountRecords(getContainer(), pending.id)
      const removed = await accounts.remove(pending.id)
      expect(removed.status).toBe(200)
      const after = await accountRecords(getContainer(), pending.id)
      expect(after).toMatchObject({ deleted: true, email: null })
      expect((await accounts.get(pending.id)).status).toBe(404)
      // Its own list and hidden group went with it
      const lists = await getContainer()
        .resolve(Modules.PRICING)
        .listPriceLists({ id: [before.priceListId ?? ""] })
      const groups = await getContainer()
        .resolve(Modules.CUSTOMER)
        .listCustomerGroups({ id: [before.groupId ?? ""] })
      expect({ lists: lists.length, groups: groups.length }).toEqual({ lists: 0, groups: 0 })

      const customer = await registerCustomer(http, store)
      const active = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      const refused = await accounts.remove(active.id)
      expect([refused.status, message(refused)]).toEqual([409, "wholesale.account_not_pending"])
    })
  },
})
