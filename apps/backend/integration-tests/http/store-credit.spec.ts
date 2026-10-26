import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { cardAccount, checkout, shippedCart } from "../helpers/gift-cards"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface AuditEntry {
  action: string
  changes: { diff?: Record<string, { before?: unknown; after?: unknown }> }
}

/** F4.8 (ADR-0025): store credit, a customer's own money at the shop, and spending it once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let variantId: string

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "kredi-urun", 20, 300)).variantId
      await flag(true)
    })

    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    const openAccount = (customerId: string) =>
      settle(
        http.post<{ store_credit_account: { id: string } }>(
          "/admin/store-credit-accounts",
          { currency_code: "try", customer_id: customerId },
          { headers: admin.headers }
        )
      )

    async function credited(customer: TestCustomer, amount: number): Promise<string> {
      const accountId = (await openAccount(customer.id)).data.store_credit_account.id
      await http.post(
        `/admin/store-credit-accounts/${accountId}/credit`,
        { amount, note: "İade" },
        { headers: admin.headers }
      )
      return accountId
    }

    // Entries are written once the response is answered
    async function auditEntries(query: string): Promise<AuditEntry[]> {
      for (let attempt = 0; attempt < 30; attempt++) {
        const { data } = await http.get<{ audit_entries: AuditEntry[] }>(
          `/admin/audit-log?kind=mutation&${query}`,
          { headers: admin.headers }
        )
        if (data.audit_entries.length > 0) {
          return data.audit_entries
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return []
    }

    it("opens accounts for customers with an account only", async () => {
      const guest = await http.post<{ customer: { id: string } }>(
        "/admin/customers",
        { email: "misafir@example.com" },
        { headers: admin.headers }
      )
      const refused = await openAccount(guest.data.customer.id)
      expect(refused.status).toBe(400)
      const member = await registerCustomer(http, store)
      expect((await openAccount(member.id)).status).toBe(200)
    })

    it("records credit with the balance before and after, and a card's making with its value", async () => {
      const member = await registerCustomer(http, store)
      const accountId = await credited(member, 50)
      const read = await http.get<{ store_credit_accounts: { id: string; balance: number }[] }>(
        `/admin/store-credit-accounts?customer_id=${member.id}&currency_code=try&fields=id,balance`,
        { headers: admin.headers }
      )
      expect(read.data.store_credit_accounts).toEqual([
        expect.objectContaining({ id: accountId, balance: 50 }),
      ])
      const [credit] = await auditEntries(`resource_id=${accountId}`)
      expect(credit).toMatchObject({
        action: "POST /admin/store-credit-accounts/:id/credit",
        changes: { diff: { balance: { before: "0", after: "50" } } },
      })

      await http.post(
        "/admin/gift-cards",
        { currency_code: "try", value: 250 },
        { headers: admin.headers }
      )
      const [made] = await auditEntries("resource_type=gift_card")
      expect(made).toMatchObject({
        action: "POST /admin/gift-cards",
        changes: { diff: { value: { after: "250" }, currency_code: { after: "try" } } },
      })
      // The code spends the card: never in the record
      expect(JSON.stringify(made)).not.toMatch(/GIFT-/u)
    })

    it("spends a customer's credit on their own cart only", async () => {
      const owner = await registerCustomer(http, store)
      const other = await registerCustomer(http, store)
      const accountId = await credited(owner, 50)
      const id = await shippedCart(getContainer(), shop, variantId, owner.id)
      const useCredit = (who: TestCustomer, cartPath = id) =>
        settle(http.post(`/store/carts/${cartPath}/store-credits`, {}, { headers: who.headers }))

      expect((await useCredit(other)).status).toBe(404)
      expect((await useCredit(other, id.replace("_", "%5F"))).status).toBe(404)
      const guestCart = await shippedCart(getContainer(), shop, variantId)
      expect((await useCredit(owner, guestCart)).status).toBe(404)
      expect((await useCredit(owner)).status).toBe(200)

      // 300 of goods and 90 shipping, 50 of it from the account
      const { paid } = await checkout(getContainer(), id)
      expect(paid).toBe(340)
      const account = await http.get<{ store_credit_account: { balance: number } }>(
        `/admin/store-credit-accounts/${accountId}?fields=balance`,
        { headers: admin.headers }
      )
      expect(account.data.store_credit_account.balance).toBe(0)
    })

    it("never spends a card's balance twice, one checkout after another or at once", async () => {
      const made = await http.post<{ gift_card: { id: string; code: string } }>(
        "/admin/gift-cards",
        { currency_code: "try", value: 400 },
        { headers: admin.headers }
      )
      const card = made.data.gift_card
      const carts = [
        await shippedCart(getContainer(), shop, variantId),
        await shippedCart(getContainer(), shop, variantId),
        await shippedCart(getContainer(), shop, variantId),
      ]
      for (const id of carts) {
        await http.post(
          `/store/carts/${id}/gift-cards`,
          { code: card.code },
          { headers: store.headers }
        )
      }
      const [first, ...rest] = carts
      const done = [await checkout(getContainer(), first ?? "")]
      const raced = await Promise.allSettled(rest.map((id) => checkout(getContainer(), id)))
      for (const outcome of raced) {
        if (outcome.status === "fulfilled") {
          done.push(outcome.value)
        }
      }

      // The card paid 400 at most, what each order took from it adds up to its debits
      const { balance, debits } = await cardAccount(getContainer(), card.id)
      expect(balance).toBeGreaterThanOrEqual(0)
      expect(debits).toBeLessThanOrEqual(400)
      const credits = await Promise.all(
        done.map(async ({ orderId }) => {
          const money = await http.get<{ money: { credit: string } }>(
            `/admin/orders/${orderId}/money`,
            { headers: admin.headers }
          )
          return Number(money.data.money.credit)
        })
      )
      expect(credits.reduce((sum, credit) => sum + credit, 0)).toBe(debits)
    })
  },
})
