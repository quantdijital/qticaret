import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { reconcileWholesaleGroups } from "../../src/workflows/wholesale/accounts/reconcile"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { accountApi, groupsOf, joinGroup, tierRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface StoreCart {
  cart: { id: string; items: { unit_price: number }[] }
}

interface AuditEntry {
  action: string
  resource_id: string | null
  changes: { result?: unknown } | null
}

/**
 * Security review of ADR-0068 slice 1b: every open cart repriced on
 * closing, counted in the answer and the audit entry (M1); carts follow
 * the flag (M2); strays taken out of wholesale groups at night (L1);
 * the account workflows kept out of the workflow store (L3); a new
 * account's audit entry names it (I1). Retail 100, the level 80.
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

    async function wholesaler(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, 50, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "66.67" }] })
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      return { ...product, tier, customer, account }
    }

    async function cartWith(customer: TestCustomer, variantId: string) {
      const made = await settle(
        http.post<StoreCart>(
          "/store/carts",
          { region_id: shop.regionId },
          {
            headers: customer.headers,
          }
        )
      )
      expect(made.status).toBe(200)
      const added = await settle(
        http.post(
          `/store/carts/${made.data.cart.id}/line-items`,
          { variant_id: variantId, quantity: 1 },
          { headers: customer.headers }
        )
      )
      expect(added.status).toBe(200)
      return made.data.cart.id
    }

    async function cartPrice(customer: TestCustomer, cartId: string) {
      const read = await settle(
        http.get<StoreCart>(`/store/carts/${cartId}`, { headers: customer.headers })
      )
      return read.status === 200 ? read.data.cart.items[0]?.unit_price : read.status
    }

    it("reprices every open cart on closing and counts them in the answer and audit (M1)", async () => {
      const { variantId, customer, account } = await wholesaler("sepetler")
      const carts = [
        await cartWith(customer, variantId),
        await cartWith(customer, variantId),
        await cartWith(customer, variantId),
      ]
      const closed = await accounts.action(account.id, "deactivate")
      expect(closed.status).toBe(200)
      expect((closed.data as { carts?: unknown }).carts).toEqual({ repriced: 3, failed: 0 })
      for (const cartId of carts) {
        expect(await cartPrice(customer, cartId)).toBe(100)
      }
      const entries = await eventually(
        async () =>
          (
            await staff.get<{ audit_entries: AuditEntry[] }>(
              `/admin/audit-log?resource_id=${account.id}&kind=mutation`
            )
          ).data.audit_entries,
        (found) => found.some((entry) => entry.action.endsWith("/deactivate"))
      )
      const entry = entries.find((each) => each.action.endsWith("/deactivate"))
      expect(entry?.changes?.result).toEqual({ carts: { repriced: 3, failed: 0 } })
    })

    it("names the new account in its audit entry (I1)", async () => {
      const { account } = await wholesaler("kayit")
      const entries = await eventually(
        async () =>
          (
            await staff.get<{ audit_entries: AuditEntry[] }>(
              `/admin/audit-log?resource_id=${account.id}&kind=mutation`
            )
          ).data.audit_entries,
        (found) => found.length > 0
      )
      expect(entries.map((entry) => entry.action)).toContain("POST /admin/wholesale/accounts")
    })

    it("moves open carts to retail when the flag goes off, and back when on (M2)", async () => {
      const { variantId, customer } = await wholesaler("bayrak")
      const cartId = await cartWith(customer, variantId)
      expect(await cartPrice(customer, cartId)).toBe(80)

      expect((await staff.flag(false)).status).toBe(200)
      expect(
        await eventually(
          () => cartPrice(customer, cartId),
          (price) => price === 100,
          150
        )
      ).toBe(100)
      expect((await staff.flag(true)).status).toBe(200)
      expect(
        await eventually(
          () => cartPrice(customer, cartId),
          (price) => price === 80,
          150
        )
      ).toBe(80)
    })

    it("takes a customer out of a wholesale group they hold no active account for (L1)", async () => {
      const { tier, customer } = await wholesaler("gece")
      const stray = await registerCustomer(http, store)
      const { groupId } = await tierRecords(getContainer(), tier.id)
      await joinGroup(getContainer(), groupId, stray.id)

      expect(await reconcileWholesaleGroups(getContainer())).toBeGreaterThanOrEqual(1)
      expect(await groupsOf(getContainer(), stray.id)).toEqual([])
      // The wholesaler stays
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
    })

    it("keeps the account workflows, which carry names and addresses, out of the store (L3)", async () => {
      const { account } = await wholesaler("depo")
      await accounts.update(account.id, { contact_name: "Veli Ak", company_name: "Ak Ticaret" })
      const engine = getContainer().resolve(Modules.WORKFLOW_ENGINE)
      for (const workflowId of [
        "wholesale-create-account",
        "wholesale-update-account",
        "wholesale-claim-account",
      ]) {
        const kept = await engine.listWorkflowExecutions({ workflow_id: workflowId })
        expect({ workflowId, kept: kept.length }).toEqual({ workflowId, kept: 0 })
      }
    })
  },
})
