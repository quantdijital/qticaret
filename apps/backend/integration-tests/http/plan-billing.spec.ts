import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { PlanBillingSummary } from "@qticaret/types/control-plane"
import type { PlanSummary } from "../../src/lib/plan-limits"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial, productBody } from "../helpers/plan-limits"
import { sellingShop } from "../helpers/plan-status"
import type { Answer, SellingShop } from "../helpers/plan-status"

jest.setTimeout(240 * 1000)

const PUSH = "/hooks/control-plane/plan"

const INSTRUCTION = "Alıcı: Quant Dijital Yazılım\nIBAN: TR12 0006 4000 0011 2345 6789 01"

const LATE: PlanBillingSummary = {
  status: "past_due",
  due_on: "2026-12-01",
  grace_ends_on: "2026-12-08",
  amount: 149_000,
  currency: "TRY",
  package_name: "Profesyonel Ağ",
  payment_instruction: INSTRUCTION,
}

/**
 * adr/0061 §5.6, §7, Ek C16 on the shop's side: Settings > Abonelik reads
 * the real billing the control plane signs (state, due day, amount, grace,
 * the package's name and how to pay), from documents with and without the
 * new fields. KK2: the billing job's restriction arrives as a signed
 * document and the shop's data stays where it was: read, sold, not deleted.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let selling: SellingShop
    const headers = () => ({ headers: selling.admin.headers })
    const push = (billing: PlanBillingSummary, status: "active" | "restricted" = "active") =>
      settle(http.post<Answer>(PUSH, signed(doc(nextSerial(), { status, billing }))))
    const plan = async () =>
      (await settle(http.get<{ plan: PlanSummary }>("/admin/plan", headers()))).data.plan

    managedForThisFile()

    beforeEach(async () => {
      selling = await sellingShop(http, getContainer())
    })

    it("shows the signed billing: state, due day, amount, grace, package name and instruction", async () => {
      expect((await push(LATE)).status).toBe(200)

      const summary = await plan()

      expect(summary).toMatchObject({
        managed: true,
        status: "active",
        package_name: "Profesyonel Ağ",
        payment_instruction: INSTRUCTION,
        billing: {
          status: "past_due",
          due_on: "2026-12-01",
          grace_ends_on: "2026-12-08",
          amount: 149_000,
          currency: "TRY",
        },
      })
      // The name and the instruction are lifted out of the billing summary; the
      // terms (Ek C20) are always there, null from a document without them
      expect(Object.keys(summary.billing ?? {}).sort()).toEqual([
        "amount",
        "currency",
        "due_on",
        "grace_ends_on",
        "period",
        "price",
        "status",
        "trial_ends_on",
        "trial_started_on",
      ])
      expect(summary.billing).toMatchObject({
        period: null,
        price: null,
        trial_started_on: null,
        trial_ends_on: null,
      })
      // The package's features: the document names neither (its test flag is left out),
      // so each takes its default
      expect(summary.features).toEqual([
        { key: "catalog.product_videos", enabled: true },
        { key: "ai.own_keys", enabled: true },
      ])
    })

    it("shows the subscription's terms a newer document carries: period, price, trial (Ek C20)", async () => {
      const trial: PlanBillingSummary = {
        status: "trialing",
        due_on: "2026-12-15",
        grace_ends_on: null,
        amount: 1_490_000,
        currency: "TRY",
        package_name: "Profesyonel Ağ",
        payment_instruction: null,
        period: "yearly",
        price: 1_490_000,
        trial_started_on: "2026-12-01",
        trial_ends_on: "2026-12-15",
      }
      expect((await push(trial)).status).toBe(200)

      expect((await plan()).billing).toEqual({
        status: "trialing",
        due_on: "2026-12-15",
        grace_ends_on: null,
        amount: 1_490_000,
        currency: "TRY",
        period: "yearly",
        price: 1_490_000,
        trial_started_on: "2026-12-01",
        trial_ends_on: "2026-12-15",
      })
      // A period the contract does not know is refused, and the last document stands
      const weekly = await push({ ...trial, period: "weekly" } as unknown as PlanBillingSummary)
      expect(weekly.status).toBe(400)
      expect((await plan()).billing?.period).toBe("yearly")
    })

    it("takes a document without the new fields (an older control plane) and one with null", async () => {
      const older = {
        status: "active" as const,
        due_on: null,
        grace_ends_on: null,
        amount: null,
        currency: "TRY" as const,
      }
      expect((await push(older)).status).toBe(200)
      expect(await plan()).toMatchObject({ package_name: null, payment_instruction: null })

      expect((await push({ ...LATE, payment_instruction: null })).status).toBe(200)
      expect(await plan()).toMatchObject({
        package_name: "Profesyonel Ağ",
        payment_instruction: null,
      })
      // A field the contract does not know is still refused (strict)
      const unknown = await push({ ...LATE, iban: "TR00" } as unknown as PlanBillingSummary)
      expect(unknown.status).toBe(400)
    })

    it("KK2: a billing restriction arrives signed and the shop's data stays where it was", async () => {
      const sold = await selling.checkout()
      expect(sold.status).toBe(200)
      const before = await counts()

      const restricted = await push(
        { ...LATE, status: "restricted", grace_ends_on: "2026-12-08" },
        "restricted"
      )
      expect(restricted.status).toBe(200)

      const summary = await plan()
      expect(summary).toMatchObject({ status: "restricted", billing: { status: "restricted" } })
      const products = await settle(http.get<{ count: number }>("/admin/products", headers()))
      const orders = await settle(http.get<{ count: number }>("/admin/orders", headers()))
      const order = await settle(http.get(`/admin/orders/${sold.data.order?.id ?? ""}`, headers()))
      const edit = await settle(
        http.post<Answer>(`/admin/products/${selling.productId}`, { title: "Yeni ad" }, headers())
      )
      const created = await settle(
        http.post<Answer>(
          "/admin/products",
          productBody("Kısıtta yeni", selling.shop.salesChannelId),
          headers()
        )
      )
      const stillSells = await selling.checkout()

      expect(products.status).toBe(200)
      expect(orders.status).toBe(200)
      expect(order.status).toBe(200)
      expect(edit.data).toMatchObject({ message: "plan.restricted", status: "restricted" })
      expect(created.status).toBe(403)
      expect(stillSells.status).toBe(200)
      // Nothing deleted, nothing hidden: what was there is there, one more order sold
      const after = await counts()
      expect(after.products).toBe(before.products)
      expect(after.orders).toBe(before.orders + 1)
      expect(after.customers).toBeGreaterThanOrEqual(before.customers)
      expect(products.data.count).toBe(before.products)
    })

    async function counts() {
      const container = getContainer()
      const [, products] = await container
        .resolve(Modules.PRODUCT)
        .listAndCountProducts({}, { take: 1 })
      const [, orders] = await container.resolve(Modules.ORDER).listAndCountOrders({}, { take: 1 })
      const [, customers] = await container
        .resolve(Modules.CUSTOMER)
        .listAndCountCustomers({}, { take: 1 })
      return { products, orders, customers }
    }
  },
})
