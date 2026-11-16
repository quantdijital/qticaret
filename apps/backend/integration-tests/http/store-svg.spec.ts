import { readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { brandOf, mailLogoSource } from "../../src/workflows/messaging/brand"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { outcome } from "../helpers/wholesale-store"

jest.setTimeout(120 * 1000)

// Where the local file provider stores uploads (its default upload_dir)
const STATIC_DIR = join(process.cwd(), "static")

const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" onload="alert(1)">' +
  '<script>alert(2)</script><defs><linearGradient id="g"><stop offset="0" stop-color="#123"/></linearGradient></defs>' +
  '<circle cx="32" cy="32" r="30" fill="url(#g)"/><image href="https://evil.example/x.png"/></svg>'

interface Site {
  shop: {
    logo_url: string | null
    favicon_url: string | null
    favicon_type: string | null
    apple_touch_url: string | null
  }
}

/**
 * SVG for the shop's logos and site icon (the owner, 2026-11-16): taken by
 * the library's upload by its content and stored only as cleaned; it may
 * stand as a logo and as the site icon (which gets a home screen PNG), and
 * nowhere else: a product's picture or the share image refuses it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("takes a cleaned SVG as logo and site icon, and refuses it as a product's picture", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const post = <T>(path: string, body: unknown) =>
        settle(http.post<T>(path, body, { headers: admin.headers }))

      const form = new FormData()
      form.append("files", new Blob([LOGO], { type: "text/plain" }), "logo.txt")
      const uploaded = await post<{ files: { id: string; url: string }[] }>("/admin/uploads", form)
      expect(uploaded.status).toBe(200)
      const file = uploaded.data.files[0]
      // What storage holds is the cleaned file, under an .svg name
      const stored = readFileSync(join(STATIC_DIR, basename(file?.url ?? "")), "utf8")
      expect(stored).toContain("<circle")
      expect(stored).not.toMatch(/script|alert|onload|evil\.example|<image/)

      const registered = await post<{ media: { id: string; url: string }[] }>("/admin/media", {
        file_ids: [file?.id],
        library: true,
      })
      const media = registered.data.media[0]
      const [record] = await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: media?.id ?? "" }, { select: ["mime_type", "width", "height"] })
      expect(record).toMatchObject({ mime_type: "image/svg+xml", width: 64, height: 64 })
      const url = media?.url ?? ""

      // A logo from outside the library is refused: what is stored is what the upload cleaned
      const outside = await post<{ message?: string }>("/admin/platform-settings/appearance", {
        logo_light_url: "https://cdn.example/logo.svg",
      })
      expect([outside.status, outside.data.message]).toEqual([
        400,
        "platform_settings.logo_unknown",
      ])

      // As the logo and the site icon (the local store's address is http: it is the upload's)
      const saved = await post("/admin/platform-settings/appearance", {
        logo_light_url: url,
        favicon_url: url,
      })
      expect(outcome(saved, 200)).toEqual({ status: 200, data: null })
      const site = (await http.get<Site>("/store/seo/site", { headers: store.headers })).data.shop
      expect(site).toMatchObject({
        logo_url: url,
        favicon_url: url,
        favicon_type: "image/svg+xml",
      })
      // Apple's home screen takes no SVG: its own PNG, made from the cleaned file
      expect(site.apple_touch_url).toMatch(/\.png$/)
      // Nor do mail clients: the light logo's PNG goes in the mails
      const [drawn] = await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: media?.id ?? "" }, { select: ["derivatives"] })
      const mail = (drawn?.derivatives as { mail_png?: { url: string } } | null)?.mail_png?.url
      expect(mail).toMatch(/\.png$/)
      expect((await brandOf(container)).logoUrl).toBeNull() // http is a developer's machine's only
      expect(await mailLogoSource(container, url)).toBe(mail)

      // Anywhere else it is refused, by what the server knows of it
      const productBody = (images: { url: string }[]) => ({
        title: "Kupa",
        images,
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
      const product = await post<{ message?: string }>("/admin/products", productBody([{ url }]))
      expect([product.status, product.data.message]).toEqual([400, "media.svg_logo_only"])
      const share = await post<{ message?: string }>("/admin/platform-settings/seo", {
        default_og_image: url,
      })
      expect([share.status, share.data.message]).toEqual([400, "media.svg_logo_only"])
      // A page's own share image neither
      const plain = await post<{ product: { id: string } }>("/admin/products", productBody([]))
      expect(outcome(plain, 200)).toEqual({ status: 200, data: null })
      const og = await settle(
        http.put<{ message?: string }>(
          `/admin/seo/product/${plain.data.product.id}`,
          { og_image_override: file?.id },
          { headers: admin.headers }
        )
      )
      expect([og.status, og.data.message]).toEqual([400, "media.svg_logo_only"])
    })
  },
})
