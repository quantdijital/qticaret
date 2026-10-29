import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_DRAFTS_MODULE } from "../../src/modules/content-drafts"
import type ContentDraftsModuleService from "../../src/modules/content-drafts/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { CONTENT_AI_DRAFTS } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const ENV = ["CONTENT_DRAFT_PROVIDER", "CONTENT_DRAFT_MONTHLY_QUOTA"] as const

interface Draft {
  id: string
  kind: string
  text: string
  status: string
}

/** F10.13 (adr/0005; KK8): drafts from a provider, published only once staff approve them. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let admin: { headers: Record<string, string> }

    const ask = (productId: string, kind: string) =>
      settle(
        http.post<{ draft?: Draft; message?: string }>(
          "/admin/content-drafts",
          { entity_type: "product", entity_id: productId, kind },
          { headers: admin.headers }
        )
      )
    const decide = (id: string, decision: "approve" | "reject") =>
      settle(
        http.post<{ status?: string; message?: string }>(
          `/admin/content-drafts/${id}/${decision}`,
          {},
          { headers: admin.headers }
        )
      )
    const page = async (productId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: ["description", "seo_meta.seo_title"],
          filters: { id: productId },
        })
      return data[0] as { description: string | null; seo_meta?: { seo_title?: string | null } }
    }
    /** A product whose description carries someone's address and phone, as pasted text may. */
    const product = async () => {
      const handle = `keten-${String(Date.now())}`
      const { productId } = await stockedProduct(getContainer(), shop, handle, 3, 450)
      await getContainer().resolve(Modules.PRODUCT).updateProducts(productId, {
        title: "Keten Gömlek Yazlık Model",
        description: "Yazlık keten gömlek. Sorular için ayse.yilmaz@example.com, 0532 123 45 67.",
      })
      return productId
    }

    beforeAll(() => {
      process.env["CONTENT_DRAFT_PROVIDER"] = "fake"
    })

    afterAll(() => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
    })

    it("asks for nothing while the platform keeps drafts off", async () => {
      const refused = await ask(await product(), "seo_title")

      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("features.disabled")
    })

    it("publishes a draft only once approved, and asks without anyone's personal data", async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.setFeature(CONTENT_AI_DRAFTS, true, null)
      try {
        const productId = await product()
        const before = await page(productId)
        const title = await ask(productId, "seo_title")
        const description = await ask(productId, "product_description")
        const meta = await ask(productId, "seo_description")
        const untouched = await page(productId)
        const [approvedTitle, approvedText, rejected] = [
          await decide(title.data.draft?.id ?? "", "approve"),
          await decide(description.data.draft?.id ?? "", "approve"),
          await decide(meta.data.draft?.id ?? "", "reject"),
        ]
        const again = await decide(meta.data.draft?.id ?? "", "approve")
        const after = await page(productId)
        const kept = await getContainer()
          .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
          .listContentDrafts({ entity_id: productId }, { select: ["prompt", "source"] })
        const listed = await http.get<{ drafts: Draft[]; quota: { used: number } }>(
          `/admin/content-drafts?entity_type=product&entity_id=${productId}`,
          { headers: admin.headers }
        )

        expect([title.status, description.status, meta.status]).toEqual([201, 201, 201])
        expect(title.data.draft?.status).toBe("draft")
        // KK8: nothing reaches the page before approval
        expect(untouched).toEqual(before)
        expect([approvedTitle.status, approvedText.status, rejected.status]).toEqual([
          200, 200, 200,
        ])
        expect(after.seo_meta?.seo_title).toBe(title.data.draft?.text)
        expect(after.description).toBe(description.data.draft?.text)
        expect(again.data.message).toBe("content_drafts.not_open")
        // KK8: the prompt left without the address and the phone in the description
        expect(kept).toHaveLength(3)
        for (const draft of kept) {
          expect(draft.source).toBe("ai_draft")
          expect(draft.prompt).toContain("keten gömlek")
          expect(draft.prompt).not.toContain("ayse.yilmaz")
          expect(draft.prompt).not.toContain("123 45 67")
        }
        expect(listed.data.drafts.map((each) => each.status).sort()).toEqual([
          "approved",
          "approved",
          "rejected",
        ])
        expect(listed.data.quota.used).toBeGreaterThanOrEqual(3)
      } finally {
        await settings.setFeature(CONTENT_AI_DRAFTS, false, null)
      }
    })

    it("stops at the month's quota", async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.setFeature(CONTENT_AI_DRAFTS, true, null)
      try {
        const productId = await product()
        const used = await getContainer()
          .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
          .usedThisMonth()
        process.env["CONTENT_DRAFT_MONTHLY_QUOTA"] = String(used + 1)
        const first = await ask(productId, "seo_title")
        const second = await ask(productId, "seo_title")

        expect(first.status).toBe(201)
        expect(second.status).toBe(400)
        expect(second.data.message).toBe("content_drafts.quota_reached")
      } finally {
        Reflect.deleteProperty(process.env, "CONTENT_DRAFT_MONTHLY_QUOTA")
        await settings.setFeature(CONTENT_AI_DRAFTS, false, null)
      }
    })
  },
})
