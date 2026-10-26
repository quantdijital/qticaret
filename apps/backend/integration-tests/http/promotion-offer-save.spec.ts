import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"

jest.setTimeout(240 * 1000)

interface Saved {
  code: string
  limit: number | null
  application_method: {
    value: number
    target_type: string
    target_rules: { attribute: string; values: { value: string }[] }[]
  }
  rules: { attribute: string; operator: string; values: { value: string }[] }[]
  campaign: {
    ends_at: string | null
    budget: { type: string; attribute: string; limit: number } | null
  } | null
}

/** F4.4/F4.5 (ADR-0024): a promotion's changes from the panel, saved whole or not at all. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let productId: string

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      const shop = await stockShop(getContainer())
      productId = (await stockedProduct(getContainer(), shop, "kayit-urun", 10, 100)).productId
    })

    async function created(): Promise<string> {
      const made = await http.post<{ promotion: { id: string } }>(
        "/admin/promotions",
        {
          code: "SEPET10",
          type: "standard",
          is_automatic: false,
          is_tax_inclusive: true,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: 10,
          },
        },
        { headers: admin.headers }
      )
      return made.data.promotion.id
    }

    const save = (id: string, body: Record<string, unknown>) =>
      settle(http.post(`/admin/promotions/${id}/offer`, body, { headers: admin.headers }))

    async function saved(id: string): Promise<Saved> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "promotion",
          fields: [
            "code",
            "limit",
            "application_method.value",
            "application_method.target_type",
            "application_method.target_rules.attribute",
            "application_method.target_rules.values.value",
            "rules.attribute",
            "rules.operator",
            "rules.values.value",
            "campaign.ends_at",
            "campaign.budget.type",
            "campaign.budget.attribute",
            "campaign.budget.limit",
          ],
          filters: { id },
        })
      return data[0] as unknown as Saved
    }

    const fields = { code: "sepet10", is_automatic: false, limit: 50 }

    it("saves every part the form changed in one call", async () => {
      const id = await created()
      const endsAt = "2026-12-31T20:59:59.000Z"
      const answer = await save(id, {
        promotion: { ...fields, application_method: { value: 15 } },
        scope: {
          target_type: "items",
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
        minimum: [{ attribute: "item_total", operator: "gte", values: ["200"] }],
        per_customer: { limit: 1 },
        dates: { starts_at: null, ends_at: endsAt },
        campaign: {
          name: "SEPET10",
          campaign_identifier: "sepet10-kayit",
          starts_at: null,
          ends_at: endsAt,
          budget: { type: "use_by_attribute", attribute: "customer_id", limit: 1 },
        },
      })
      expect(answer.status).toBe(200)
      const promotion = await saved(id)
      expect(promotion).toMatchObject({
        code: "SEPET10",
        limit: 50,
        application_method: { value: 15, target_type: "items" },
        campaign: { budget: { type: "use_by_attribute", attribute: "customer_id", limit: 1 } },
      })
      expect(promotion.application_method.target_rules).toEqual([
        expect.objectContaining({
          attribute: "items.product.id",
          values: [expect.objectContaining({ value: productId })],
        }),
      ])
      expect(promotion.rules).toEqual([
        expect.objectContaining({ attribute: "item_total", operator: "gte" }),
      ])
      expect(new Date(promotion.campaign?.ends_at ?? 0).toISOString()).toBe(endsAt)
    })

    it("leaves the promotion as it was when a later part fails", async () => {
      const id = await created()
      // Buy rules belong to "X al Y öde" alone: Medusa refuses them after the value is saved
      const answer = await save(id, {
        promotion: { ...fields, application_method: { value: 40 } },
        scope: {
          target_type: "order",
          target_rules: [],
          buy_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
      })
      expect(answer.status).toBeGreaterThanOrEqual(400)
      expect(await saved(id)).toMatchObject({
        code: "SEPET10",
        limit: null,
        application_method: { value: 10, target_type: "order" },
      })
    })

    it("refuses a code the shop could not keep", async () => {
      const id = await created()
      const answer = await save(id, { promotion: { ...fields, code: "=1+1" } })
      expect(answer.status).toBe(400)
    })
  },
})
