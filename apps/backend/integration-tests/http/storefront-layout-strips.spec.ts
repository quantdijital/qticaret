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

// A draft needs no weight or dimensions; a published product does (F3.1)
const productBody = (title: string, status: "draft" | "published") => ({
  title,
  status,
  ...(status === "published" ? { weight: 250, length: 30, width: 5, height: 2 } : {}),
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

/** adr/0049 Ek 2026-11-16: the strip gallery, two to eight strips each with a source. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves strips of live sources and the shop's own picture, refuses bad ones, leaves a gone source out keeping places", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      await settle(
        http.post("/admin/platform-settings/store", { contact_phone: "0532 123 45 67" }, asOwner)
      )
      const product = async (title: string, status: "draft" | "published") =>
        (
          await settle(
            http.post<{ product: { id: string } }>(
              "/admin/products",
              productBody(title, status),
              asOwner
            )
          )
        ).data.product.id
      const knife = await product("Şef Bıçağı", "published")
      const fading = await product("Ekmek Bıçağı", "published")
      const draft = await product("Taslak Bıçak", "draft")
      const category = (
        await settle(
          http.post<{ product_category: { id: string } }>(
            "/admin/product-categories",
            { name: "Çakılar", is_active: true },
            asOwner
          )
        )
      ).data.product_category.id
      const bytes = await sharp({
        create: { width: 60, height: 90, channels: 3, background: { r: 30, g: 32, b: 40 } },
      })
        .png()
        .toBuffer()
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "serit.png")
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
      const picture = registered.data.media[0]?.url ?? ""
      expect(picture).not.toBe("")

      const gallery = (items: unknown[], more: Record<string, unknown> = {}): Section => ({
        id: "seritler01",
        type: "strip_gallery",
        ...ALWAYS,
        title: "Atölyeden",
        text: "Sorularınız için {telefon}",
        items,
        ...more,
      })
      const strips = [
        { source: { kind: "product", target: knife } },
        { source: { kind: "product", target: fading }, title: "Ekmek için", note: "Tırtıklı ağız" },
        {
          source: { kind: "category", target: category },
          link: { kind: "system", target: "shop", label: null },
        },
        {
          source: { kind: "custom" },
          image: { url: picture, alt: "Tezgâh" },
          title: "{telefon}",
          link: { kind: "category", target: category, label: null },
        },
      ]
      const save = (home: Section[]) =>
        settle(
          http.post<{ message?: string }>(
            "/admin/storefront-layout",
            { document: { header: [], home, footer: [], product: [], category: [] } },
            asOwner
          )
        )

      const lone = await save([gallery(strips.slice(0, 1))])
      const tooMany = await save([gallery([...strips, ...strips, ...strips.slice(0, 1)])])
      const bare = await save([gallery([strips[0], { source: { kind: "custom" } }])])
      const outside = await save([
        gallery([
          strips[0],
          { source: { kind: "custom" }, image: { url: "https://baska.example/a.jpg", alt: null } },
        ]),
      ])
      const unknownSource = await save([
        gallery([strips[0], { source: { kind: "product", target: "prod_yok" } }]),
      ])
      const unknownLink = await save([
        gallery([
          strips[0],
          {
            source: { kind: "category", target: category },
            link: { kind: "category", target: "pcat_yok", label: null },
          },
        ]),
      ])
      const offList = await save([gallery(strips, { strips_slant: "dik" })])
      const saved = await save([
        gallery([...strips, { source: { kind: "product", target: draft } }], {
          height: "high",
          strips_overlap: "on",
        }),
      ])

      for (const refused of [lone, tooMany, bare, outside, offList]) {
        expect(refused.status).toBe(400)
      }
      expect(unknownSource.status).toBe(400)
      expect(unknownSource.data.message).toBe("storefront_layout.target_unknown")
      expect(unknownLink.status).toBe(400)
      expect(unknownLink.data.message).toBe("storefront_layout.target_unknown")
      expect(saved.status).toBe(200)

      // One source taken off sale after saving: its strip is left out, the others keep their place
      await settle(http.post(`/admin/products/${fading}`, { status: "draft" }, asOwner))
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const live = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      const [read] = live.data.layout.home
      expect(read).toMatchObject({
        id: "seritler01",
        type: "strip_gallery",
        title: "Atölyeden",
        text: "Sorularınız için 0532 123 45 67",
        width: "full",
        height: "high",
        captions: "on",
        strips_slant: "medium",
        strips_line: "thin",
        strips_overlap: "on",
        strips_dim: "on",
      })
      const items = (read?.["items"] ?? []) as Record<string, unknown>[]
      expect(items.map((each) => each["at"])).toEqual([0, 2, 3])
      expect(items[0]).toMatchObject({
        source: { kind: "product", target: knife },
        image: null,
        title: null,
        note: null,
        link: null,
      })
      expect(items[1]).toMatchObject({
        source: { kind: "category", target: category },
        link: { kind: "system", target: "shop" },
      })
      expect(items[2]).toMatchObject({
        source: { kind: "custom" },
        image: { url: picture, alt: "Tezgâh", width: 60, height: 90 },
        title: "0532 123 45 67",
        link: { kind: "category", target: category, label: "Çakılar" },
      })
      // A gone or draft source's id never leaves the backend
      expect(JSON.stringify(read)).not.toContain(fading)
      expect(JSON.stringify(read)).not.toContain(draft)

      // Every source gone: the section is not drawn at all
      await save([gallery(strips.slice(0, 2))])
      await settle(http.post(`/admin/products/${knife}`, { status: "draft" }, asOwner))
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const none = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      expect(none.data.layout.home).toEqual([])
    })
  },
})
