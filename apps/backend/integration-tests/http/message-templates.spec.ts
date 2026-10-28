import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Preview {
  name: string
  kind: string
  email: { subject: string; html: string; text: string } | null
  sms: string | null
  message?: string
}

/** F9.3 (adr/0036): the panel's preview of each message, in the shop's brand; nothing is sent. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const PATH = "/admin/messaging/templates"

    const get = <T>(path: string, headers = admin.headers) =>
      settle(http.get<T & { message?: string }>(path, { headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("lists every template and previews one in the shop's name, escaped, not cached", async () => {
      const stores = getContainer().resolve(Modules.STORE)
      const [store] = await stores.listStores({}, { take: 1 })
      await stores.updateStores(store?.id ?? "", { name: "Örnek <b>Mağaza</b>" })

      const list = await get<{ templates: { name: string; kind: string; channels: string[] }[] }>(
        PATH
      )
      const preview = await get<Preview>(`${PATH}/order.placed/preview`)

      expect(list.status).toBe(200)
      expect(list.data.templates).toHaveLength(15)
      expect(list.data.templates).toContainEqual({
        name: "marketing.announcement",
        kind: "commercial",
        channels: ["email", "sms"],
      })
      expect(preview.status).toBe(200)
      expect(preview.headers["cache-control"]).toBe("no-store")
      expect(preview.data).toMatchObject({ name: "order.placed", kind: "transactional" })
      expect(preview.data.email?.subject).toContain("#1042")
      expect(preview.data.email?.html).toContain("Örnek &lt;b&gt;Mağaza&lt;/b&gt;")
      expect(preview.data.email?.html).not.toContain("<b>Mağaza</b>")
      expect(preview.data.sms).toContain("#1042")
    })

    it("answers an unknown template, or an object's own key, with not found", async () => {
      const unknown = await get<Preview>(`${PATH}/order.lost/preview`)
      const inherited = await get<Preview>(`${PATH}/constructor/preview`)

      expect(unknown.status).toBe(404)
      expect(unknown.data.message).toBe("messaging.template_unknown")
      expect(inherited.status).toBe(404)
    })

    it("shows nothing to a visitor without a staff session", async () => {
      const list = await get<unknown>(PATH, {})
      const preview = await get<unknown>(`${PATH}/order.placed/preview`, {})

      expect(list.status).toBe(401)
      expect(preview.status).toBe(401)
    })
  },
})
