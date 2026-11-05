import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface StoreLayout {
  layout: { home: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const document = (home: Section[], product: Section[] = []) => ({
  document: { header: [], home, footer: [], product, category: [] },
})

/** adr/0049 Ek 2026-11-06: the home page's sliding opening, beside the still hero. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves a slider of the shop's uploads, reads it with sizes, filled words and live links", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      await settle(
        http.post("/admin/platform-settings/store", { contact_phone: "0532 123 45 67" }, asOwner)
      )
      const category = (
        await settle(
          http.post<{ product_category: { id: string } }>(
            "/admin/product-categories",
            { name: "Çakılar", is_active: true },
            asOwner
          )
        )
      ).data.product_category.id
      const upload = async (name: string, width: number, height: number) => {
        const bytes = await sharp({
          create: { width, height, channels: 3, background: { r: 30, g: 32, b: 40 } },
        })
          .png()
          .toBuffer()
        const form = new FormData()
        form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), name)
        const { data: uploaded } = await http.post<{ files: { id: string }[] }>(
          "/admin/uploads",
          form,
          asOwner
        )
        const registered = await settle(
          http.post<{ media: { url: string }[] }>(
            "/admin/media",
            { file_ids: uploaded.files.map((file) => file.id), library: true },
            asOwner
          )
        )
        const url = registered.data.media[0]?.url
        if (!url) {
          throw new Error("no media registered")
        }
        return url
      }
      const wide = await upload("genis.png", 96, 40)
      const narrow = await upload("dar.png", 40, 48)
      const second = await upload("ikinci.png", 96, 40)

      const slider: Section = {
        id: "kayangiris",
        type: "hero_slider",
        ...ALWAYS,
        slides: [
          {
            image: { url: wide, alt: "Tezgâhta çakılar" },
            mobile_image: { url: narrow, alt: null },
            heading: "Sorularınız için {telefon}",
            text: "Atölyeden yeni gelenler.",
            link: { kind: "category", target: category, label: null },
            position: "right",
            tone: "dark",
          },
          {
            image: { url: second, alt: null },
            heading: null,
            link: { kind: "system", target: "shop", label: "Tüm ürünler" },
          },
        ],
        autoplay: true,
        interval: 8,
      }
      const save = (body: ReturnType<typeof document>) =>
        settle(http.post<{ message?: string }>("/admin/storefront-layout", body, asOwner))

      const outside = await save(
        document([
          {
            ...slider,
            slides: [
              { image: { url: "https://baska.example/resim.jpg", alt: null } },
              { image: { url: second, alt: null } },
            ],
          },
        ])
      )
      const lone = await save(
        document([{ ...slider, slides: [{ image: { url: wide, alt: null } }] }])
      )
      const onProductPage = await save(document([], [slider]))
      const unknownTarget = await save(
        document([
          {
            ...slider,
            slides: [
              { image: { url: wide, alt: null }, link: { kind: "category", target: "pcat_yok" } },
              { image: { url: second, alt: null } },
            ],
          },
        ])
      )
      const saved = await save(document([slider, { id: "girisbolumu", type: "hero" }]))

      expect(outside.status).toBe(400)
      expect(lone.status).toBe(400)
      expect(onProductPage.status).toBe(400)
      expect(onProductPage.data.message).toBe("storefront_layout.section_invalid")
      expect(unknownTarget.status).toBe(400)
      expect(unknownTarget.data.message).toBe("storefront_layout.target_unknown")
      expect(saved.status).toBe(200)

      const preview = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = preview.data.path.split("/").pop() ?? ""
      const shown = await settle(
        http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
          headers: store.headers,
        })
      )
      const [read, hero] = shown.data.layout.home
      expect(hero?.type).toBe("hero")
      expect(read).toMatchObject({
        id: "kayangiris",
        type: "hero_slider",
        height: "regular",
        autoplay: true,
        interval: 8,
        dots: true,
        arrows: true,
        slides: [
          {
            image: { url: wide, alt: "Tezgâhta çakılar", width: 96, height: 40 },
            mobile_image: { url: narrow, alt: null, width: 40, height: 48 },
            heading: "Sorularınız için 0532 123 45 67",
            text: "Atölyeden yeni gelenler.",
            link: { kind: "category", target: category, label: "Çakılar" },
            position: "right",
            tone: "dark",
          },
          {
            image: { url: second, width: 96, height: 40 },
            mobile_image: null,
            heading: null,
            text: null,
            link: { kind: "system", target: "shop", label: "Tüm ürünler" },
            position: "left",
            tone: "light",
          },
        ],
      })

      // Published, the storefront reads it as the preview did
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const live = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      expect(live.data.layout.home.map((section) => section.type)).toEqual(["hero_slider", "hero"])
    })
  },
})
