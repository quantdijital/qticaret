import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface StoreImage {
  category_id: string
  url: string
  alt: string | null
  width: number | null
  height: number | null
}

/** adr/0046 Ek 2026-11-04: a category's picture from the media library, for cards and the mega menu. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("sets a library picture, serves it for live categories only, and keeps it from deletion", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const post = <T>(url: string, body: unknown) =>
        settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
      const category = async (name: string, isActive: boolean) =>
        (
          await post<{ product_category: { id: string } }>("/admin/product-categories", {
            name,
            is_active: isActive,
          })
        ).data.product_category.id
      const live = await category("Mutfak", true)
      const hidden = await category("Arşiv", false)
      const bytes = await sharp({
        create: { width: 64, height: 48, channels: 3, background: { r: 40, g: 90, b: 160 } },
      })
        .png()
        .toBuffer()
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "mutfak.png")
      const { data: uploaded } = await http.post<{ files: { id: string }[] }>(
        "/admin/uploads",
        form,
        admin
      )
      const registered = await post<{ media: { id: string; url: string }[] }>("/admin/media", {
        file_ids: uploaded.files.map((file) => file.id),
        library: true,
      })
      const media = registered.data.media[0]
      if (!media) {
        throw new Error("no media registered")
      }
      const storeImages = () =>
        http.get<{ images: StoreImage[] }>("/store/category-images", { headers: store.headers })

      const outside = await post(`/admin/category-images/${live}`, {
        image: { url: "https://baska.example/resim.png", alt: null },
      })
      const unknown = await post("/admin/category-images/pcat_yok", {
        image: { url: media.url, alt: null },
      })
      const set = await post(`/admin/category-images/${live}`, {
        image: { url: media.url, alt: "Mutfak bıçakları" },
      })
      await post(`/admin/category-images/${hidden}`, { image: { url: media.url, alt: null } })
      const shown = await storeImages()
      const listed = await http.get<{ images: { category_id: string }[] }>(
        "/admin/category-images",
        { headers: admin.headers }
      )
      const detail = await http.get<{ media: { usage: { kind: string; id: string | null }[] } }>(
        `/admin/media/${media.id}`,
        { headers: admin.headers }
      )
      const refused = await settle(
        http.delete<{ message?: string }>(`/admin/media/${media.id}`, { headers: admin.headers })
      )
      await post(`/admin/category-images/${live}`, { image: null })
      await post(`/admin/category-images/${hidden}`, { image: null })
      const cleared = await storeImages()
      const deleted = await settle(
        http.delete(`/admin/media/${media.id}`, { headers: admin.headers })
      )

      expect(outside.status).toBe(400)
      expect(outside.data.message).toBe("catalog.category_image_unknown")
      expect(unknown.status).toBe(404)
      expect(set.status).toBe(200)
      // An inactive category's picture is not the shopper's
      expect(shown.data.images).toEqual([
        {
          category_id: live,
          url: media.url,
          alt: "Mutfak bıçakları",
          width: 64,
          height: 48,
          derivatives: null,
        },
      ])
      expect(shown.headers["cache-control"]).toContain("max-age=300")
      expect(listed.data.images.map((each) => each.category_id).sort()).toEqual(
        [live, hidden].sort()
      )
      expect(detail.data.media.usage).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "category", id: live })])
      )
      expect(refused.status).toBe(409)
      expect(refused.data.message).toBe("media.in_use")
      expect(cleared.data.images).toEqual([])
      expect(deleted.status).toBe(200)
    })
  },
})
