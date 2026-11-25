import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { PlanSummary } from "../../src/lib/plan-limits"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import { createAdminUser } from "../helpers/admin"
import { doc, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { productBody } from "../helpers/plan-limits"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

/**
 * adr/0061 Ek C14: without a control plane (development, a shop run on its
 * own) there is no plan, no limit and no status, even with a document stored: the
 * shop works as before C14 and its Abonelik page says it has no limits.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("limits nothing and reports no plan", async () => {
      const admin = await createAdminUser(http, getContainer())
      const { salesChannelId, headers: storeHeaders } = await createStorefront(getContainer())
      const zero = Object.fromEntries(
        ["products", "orders_per_month", "staff", "storage_mb", "llm_credits_per_month"].map(
          (key) => [key, 0]
        )
      )
      await getContainer()
        .resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
        .storePlanDocument(
          signed(
            doc(1, {
              // Ek C15: nor any status: a suspended document closes nothing here
              status: "suspended",
              limits: { ...doc(1).limits, ...zero, custom_domains: 0 },
            })
          ),
          "push"
        )
      const made = await Promise.all(
        ["Bir", "İki"].map(async (title) =>
          settle(
            http.post("/admin/products", productBody(title, salesChannelId), {
              headers: admin.headers,
            })
          )
        )
      )
      const { data } = await http.get<{ plan: PlanSummary }>("/admin/plan", {
        headers: admin.headers,
      })

      expect(made.map((answer) => answer.status)).toEqual([200, 200])
      expect(data.plan).toMatchObject({
        managed: false,
        status: "active",
        package_code: null,
        billing: null,
      })
      // No limit; a grant (adr/0085 K5) gives none without a plan
      expect(
        data.plan.limits.every((limit) => limit.max === (limit.kind === "grant" ? 0 : null))
      ).toBe(true)
      expect(data.plan.limits.find((limit) => limit.key === "products")?.used).toBe(2)
      // Ek C15: the panel's strip and the storefront's edge hear an open shop
      const me = await http.get<{ plan: { status: string } }>("/admin/staff/me", {
        headers: admin.headers,
      })
      const site = await http.get<{ suspended?: boolean }>("/store/seo/site", {
        headers: storeHeaders,
      })
      expect(me.data.plan).toEqual({ status: "active" })
      expect(site.data.suspended).toBe(false)
    })
  },
})
