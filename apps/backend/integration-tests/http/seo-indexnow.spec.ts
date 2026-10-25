import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Transport, TransportRequest } from "../../src/lib/clients"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { announceChanges } from "../../src/workflows/seo/indexnow"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

const product = (title: string) => ({
  title,
  status: "published",
  weight: 250,
  length: 30,
  width: 5,
  height: 2,
  options: [{ title: "Boyut", values: ["Standart"] }],
  variants: [
    {
      title: "Standart",
      options: { Boyut: "Standart" },
      manage_inventory: false,
      prices: [{ currency_code: "try", amount: 1000 }],
    },
  ],
})

/** F3.15 (docs/13 §6): changed pages announced to IndexNow, behind its flag. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    // Records the calls instead of sending them
    const recorder = () => {
      const sent: TransportRequest[] = []
      const transport: Transport = (request) => {
        sent.push(request)
        return Promise.resolve({ status: 200, header: () => null, text: "" })
      }
      return { sent, transport }
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
      await settings().setFeature("seo.indexnow", false, null)
    })

    it("sends nothing while the flag is off or without a main domain", async () => {
      const { sent, transport } = recorder()
      expect(await announceChanges(getContainer(), { transport })).toEqual({ skipped: "flag_off" })
      await settings().setFeature("seo.indexnow", true, null)
      expect(await announceChanges(getContainer(), { transport })).toEqual({
        skipped: "host_missing",
      })
      expect(sent).toHaveLength(0)
    })

    it("announces changed pages and given-up paths once, with the key the storefront serves", async () => {
      await settings().setFeature("seo.indexnow", true, null)
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await http.post("/admin/products", product("Keten Gömlek"), { headers: admin.headers })
      const { data } = await http.post<{ product: { id: string } }>(
        "/admin/products",
        product("Seramik Kupa"),
        { headers: admin.headers }
      )
      await http.post(
        `/admin/products/${data.product.id}`,
        { handle: "el-yapimi-kupa" },
        { headers: admin.headers }
      )

      const { sent, transport } = recorder()
      const outcome = await announceChanges(getContainer(), { transport })
      expect(outcome).toEqual({ sent: 3 })
      expect(sent[0]?.url).toBe("https://api.indexnow.org/indexnow")
      const body = JSON.parse(sent[0]?.body ?? "{}") as { key: string; urlList: string[] }
      expect(body.urlList.sort()).toEqual([
        "https://magaza.example.com/urun/el-yapimi-kupa",
        "https://magaza.example.com/urun/keten-gomlek",
        "https://magaza.example.com/urun/seramik-kupa",
      ])

      const site = await http.get<{ indexnow_key: string | null }>("/store/seo/site", {
        headers: store.headers,
      })
      expect(site.data.indexnow_key).toBe(body.key)
      expect(body.key).toMatch(/^[a-f0-9]{32}$/)

      expect(await announceChanges(getContainer(), { transport })).toEqual({
        skipped: "nothing_changed",
      })
    })
  },
})
