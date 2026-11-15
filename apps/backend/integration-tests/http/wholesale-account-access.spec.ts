import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import {
  accountApi,
  accountRecords,
  legacyPendingAccount,
  testPassword,
  wholesaleApi,
} from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

const message = (answer: { data: unknown }) => (answer.data as { message?: string }).message

/**
 * ADR-0068 §9 for wholesalers (slice 1b): the routes take the account's id
 * only, its hidden group and own list are the module's (read as missing,
 * written as `wholesale.managed` through Medusa's routes, left out of its
 * lists), only a pending wholesaler (one invited before staff set
 * passwords, Ek 2026-11-15 (2)) is taken back, with its own list, a new
 * password is set for a bound one only, and the customer's wholesale link
 * is the managers' to expand (M3).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let accounts: ReturnType<typeof accountApi>
    let store: Storefront
    let admin: Awaited<ReturnType<typeof createAdminUser>>

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
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
      const pending = await legacyPendingAccount(getContainer(), {
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

    it("sets a new password only on an open account whose sign-in staff made (review M4)", async () => {
      const pending = await legacyPendingAccount(getContainer(), { email: fresh() })
      const unbound = await accounts.password(pending.id, testPassword())
      expect([unbound.status, message(unbound)]).toEqual([409, "wholesale.account_not_bound"])

      // A customer who proved their own address keeps their own password
      const customer = await registerCustomer(http, store)
      const kept = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      const own = await accounts.password(kept.id, testPassword())
      expect([own.status, message(own)]).toEqual([409, "wholesale.password_own_login"])
      expect((await accounts.get(kept.id)).data.account).toMatchObject({ staff_login: false })

      const made = await accounts.made({
        email: fresh(),
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      expect((await accounts.get(made.id)).data.account).toMatchObject({ staff_login: true })
      const weak = await accounts.password(made.id, "123")
      expect(weak.status).toBe(400)
      const extra = await staff.post(`/admin/wholesale/accounts/${made.id}/password`, {
        password: testPassword(),
        email: "x@example.com",
      })
      expect(extra.status).toBe(400)
      // Not on a closed account
      expect((await accounts.action(made.id, "deactivate")).status).toBe(200)
      const closed = await accounts.password(made.id, testPassword())
      expect([closed.status, message(closed)]).toEqual([409, "wholesale.account_not_active"])
    })

    it("asks staff to prove themselves again for a new password and a take-over (review M4)", async () => {
      const made = await accounts.made({
        email: fresh(),
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      const plain = accountApi(http, admin.plain)
      expect((await plain.password(made.id, testPassword())).status).toBe(428)
      const takeOver = await plain.create({
        email: fresh(),
        contact_name: "Ali",
        own_prices: true,
        take_over: true,
      })
      expect(takeOver.status).toBe(428)
      // An ordinary opening needs no proof
      const ordinary = await plain.create({ email: fresh(), contact_name: "Ali", own_prices: true })
      expect(ordinary.status).toBe(201)
    })

    it("expands a customer's wholesale link for the owner and admin only (M3)", async () => {
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        own_prices: true,
      })
      const asks = [
        `/admin/customers/${customer.id}?fields=*wholesale_account`,
        `/admin/customers?fields=id,+wholesale_account.status`,
        `/admin/orders?fields=id,customer.wholesale_account.*`,
      ]
      for (const role of ["operations", "readonly"] as const) {
        const other = wholesaleApi(
          http,
          (await createAdminUser(http, getContainer(), role)).headers
        )
        for (const url of asks) {
          const answer = await other.get(url)
          expect({ role, url, status: answer.status }).toEqual({ role, url, status: 400 })
          expect(JSON.stringify(answer.data)).not.toContain(account.id)
        }
      }
      const owned = await staff.get<{ customer: Record<string, unknown> }>(asks[0] ?? "")
      expect(owned.status).toBe(200)
      expect(JSON.stringify(owned.data)).toContain(account.id)
    })

    // Opening a wholesaler mails no one any more (Ek 2026-11-15 (2)): it counts against the
    // wholesale writes' budget (`bulk_ship`), thirty in ten minutes per staff member from any
    // address. Its per-address ten a minute is multiplied in integration tests (`perIpScale`);
    // the per-person count is not, and is what this measures
    it("counts openings against a staff member's wholesale budget: thirty in ten minutes", async () => {
      const statuses: number[] = []
      for (let i = 0; i < 31; i += 1) {
        const made = await accounts.create({
          email: fresh(),
          contact_name: "Ali",
          own_prices: true,
        })
        statuses.push(made.status)
      }
      expect(statuses.slice(0, 30).every((status) => status === 201)).toBe(true)
      expect(statuses[30]).toBe(429)
    })
  },
})
