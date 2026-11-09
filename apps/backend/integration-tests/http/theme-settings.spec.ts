import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Frame {
  storefront: { primary_color: string | null }
  theme: {
    theme: string
    colors: { primary: string | null; accent: string | null; background: string }
    typography: { heading: string; body: string }
    radius: string
    product_card: { ratio: string; show_brand: boolean; show_rating: boolean }
    header: { layout: string; sticky: boolean }
    buttons: string
  }
}

/** F18 D11 (adr/0053): the shop picks its look from fixed lists; the storefront reads it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves the theme, serves it to the storefront and refuses an unreadable main colour", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const ops = await createAdminUser(http, container, "operations")
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const save = (headers: Record<string, string>, body: unknown) =>
        settle(http.post("/admin/platform-settings/theme", body, { headers }))

      const before = await frame()
      // The storefront section's colour stands in until the theme has its own
      await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { primary_color: "#0B5C99" },
          { headers: owner.headers }
        )
      )
      const fallback = await frame()
      const pale = await save(admin.headers, { colors: { primary: "#fde68a" } })
      const fontAddress = await save(admin.headers, {
        typography: { heading: "https://fonts.example/x.woff2" },
      })
      const css = await save(admin.headers, { css: "body{display:none}" })
      const byOps = await save(ops.headers, { radius: "round" })
      const saved = await save(admin.headers, {
        colors: { primary: "#1E3A8A", background: "cool" },
        typography: { heading: "playfair" },
        product_card: { show_rating: true },
        header: { layout: "left" },
        buttons: "rounded",
      })
      const after = await frame()

      expect(before.status).toBe(200)
      expect(before.data.theme).toEqual({
        theme: "atolye",
        colors: { primary: null, accent: null, background: "warm" },
        typography: { heading: "fraunces", body: "inter" },
        radius: "soft",
        product_card: { ratio: "4:5", show_brand: true, show_rating: false },
        header: { layout: "centered", sticky: true },
        buttons: "pill",
      })
      expect(fallback.data.theme.colors.primary).toBe("#0b5c99")
      expect(pale.status).toBe(400)
      expect(pale.data).toMatchObject({ message: "platform_settings.color_contrast" })
      expect([fontAddress.status, css.status]).toEqual([400, 400])
      expect(byOps.status).toBe(403)
      expect(saved.status).toBe(200)
      expect(after.data.theme).toEqual({
        theme: "atolye",
        colors: { primary: "#1e3a8a", accent: null, background: "cool" },
        typography: { heading: "playfair", body: "inter" },
        radius: "soft",
        product_card: { ratio: "4:5", show_brand: true, show_rating: true },
        header: { layout: "left", sticky: true },
        buttons: "rounded",
      })
      // The old field stays until the storefront and the panel move over
      expect(after.data.storefront.primary_color).toBe("#0b5c99")
    })
  },
})
