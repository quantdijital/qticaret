import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { refreshLandingOriginality } from "../../src/workflows/content/landing-originality"
import { changedPaths } from "../../src/workflows/seo/indexnow"
import { buildSitemap } from "../../src/workflows/seo/sitemap-build"
import type { HttpClient } from "../helpers/http"
import { doc, landingKit, words } from "../helpers/landings"
import type { Answer, Landing, LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

/**
 * F3.16 (docs/13 §7, docs/14 L-UNIQ-01): who owns a text, which products
 * a page lists, its address after its category goes, and where it is
 * announced.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit

    const read = async (id: string) =>
      (
        await http.get<{ landing: Landing }>(`/admin/landings/${id}`, {
          headers: kit.admin.headers,
        })
      ).data.landing
    const published = (value: string, title: string, text: string, key?: string) =>
      kit.landing(value, { title, status: "published", body: doc(text) }, key)
    const category = async (body: Record<string, unknown>) =>
      (
        await kit.post<{ product_category: { id: string } }>("/admin/product-categories", {
          is_active: true,
          ...body,
        })
      ).data.product_category.id
    // Category deletions reach the paths through an event
    async function eventually<T>(look: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
      let value = await look()
      for (let attempt = 0; attempt < 30 && !done(value); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        value = await look()
      }
      return value
    }
    const settled = (path: string, type: string): Promise<Answer> =>
      eventually(
        () => kit.resolve(path),
        (answer) => answer.type === type
      )

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
    })

    it("keeps a text its first live page's: a later copy never lowers it", async () => {
      const text = words("ortak", 320)
      const original = (await published("seramik", "Seramik kupalar", text)).data.landing
      const copy = (await kit.landing("porselen", { title: "Porselen", body: doc(text) })).data
        .landing
      expect(copy.originality).toBeLessThan(30)

      const retitled = await kit.post<{ landing: Landing }>(`/admin/landings/${original.id}`, {
        title: "Seramik kupa seçkisi",
      })
      expect([retitled.status, retitled.data.landing.originality]).toEqual([200, 100])
      await refreshLandingOriginality(getContainer())
      expect((await read(original.id)).originality).toBe(100)
      expect((await read(copy.id)).originality).toBeLessThan(30)

      // The original's text changed: the old one is free to go live elsewhere
      await kit.post(`/admin/landings/${original.id}`, { body: doc(words("yeni", 320)) })
      const live = await kit.post<{ landing: Landing }>(`/admin/landings/${copy.id}`, {
        status: "published",
      })
      expect([live.status, live.data.landing.originality]).toEqual([200, 100])
    })

    it("serves a live copy noindex and keeps it out of the sitemap until its text is its own", async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const text = words("ortak", 320)
      await published("seramik", "Seramik kupalar", text)
      // The owner, 2026-11-05: live all the same, protected without a block
      const copy = (await published("porselen", "Porselen kupalar", text)).data.landing
      expect(copy).toMatchObject({ status: "published" })
      expect(copy.originality).toBeLessThan(30)
      const listed = async (path: string) =>
        (await buildSitemap(getContainer()))?.files.some((file) => file.content.includes(path))

      expect((await kit.resolve("/kategori/ev-ve-yasam/seramik")).seo?.robots).toBe("index,follow")
      expect((await kit.resolve("/kategori/ev-ve-yasam/porselen")).seo?.robots).toBe(
        "noindex,follow"
      )
      expect(await listed("/kategori/ev-ve-yasam/seramik")).toBe(true)
      expect(await listed("/kategori/ev-ve-yasam/porselen")).toBe(false)

      // Its own text again: the page's own robots value, back in the sitemap
      const rewritten = await kit.post<{ landing: Landing }>(`/admin/landings/${copy.id}`, {
        body: doc(words("porselen", 320)),
      })
      expect(rewritten.data.landing.originality).toBe(100)
      expect((await kit.resolve("/kategori/ev-ve-yasam/porselen")).seo?.robots).toBe("index,follow")
      expect(await listed("/kategori/ev-ve-yasam/porselen")).toBe(true)
    })

    it("takes the handle from the option's name, or the title, when its value makes no slug", async () => {
      const steel = await kit.landing("paslanmaz_celik", { title: "Çelik kupalar" })
      expect(steel.data.landing.handle).toBe("paslanmaz-celik")
      const sized = await kit.landing("42", { title: "Küçük kupalar" })
      expect(sized.data.landing.handle).toBe("kucuk-kupalar")
    })

    it("lists a multiple choice option's products, in the shown categories below", async () => {
      const blue = (await kit.landing("mavi", { title: "Mavi kupalar" }, "renk")).data.landing
      expect(blue.product_count).toBe(3)

      const cups = await category({ name: "Kupalar", parent_category_id: kit.categoryId })
      await kit.product("kupa-4", { malzeme: "seramik", renk: ["mavi"] }, cups)
      expect((await read(blue.id)).product_count).toBe(4)
      await kit.post(`/admin/product-categories/${cups}`, { is_active: false })
      expect((await read(blue.id)).product_count).toBe(3)
    })

    it("answers 410 for a deleted page, and for the pages of a deleted category", async () => {
      const ceramic = (await published("seramik", "Seramik kupalar", words("seramik", 320))).data
        .landing
      await http.delete(`/admin/landings/${ceramic.id}`, { headers: kit.admin.headers })
      expect(await kit.resolve("/kategori/ev-ve-yasam/seramik")).toMatchObject({ type: "gone" })

      const kitchen = await category({ name: "Mutfak Gereçleri" })
      const made = await kit.post<{ landing: Landing }>("/admin/landings", {
        category_id: kitchen,
        facet: { kind: "attribute", key: "malzeme", value: "porselen" },
        title: "Porselen gereçler",
        status: "published",
        body: doc(words("porselen", 320)),
      })
      expect(made.data.landing.path).toBe("/kategori/mutfak-gerecleri/porselen")
      await http.delete(`/admin/product-categories/${kitchen}`, { headers: kit.admin.headers })
      expect(await settled("/kategori/mutfak-gerecleri/porselen", "gone")).toMatchObject({
        type: "gone",
      })
      // The page's own path is released after its category's, by the same event
      const page = await eventually(
        () => read(made.data.landing.id),
        (landing) => landing.path === null
      )
      expect(page.path).toBeNull()
    })

    it("is in the sitemap and IndexNow while its category shows, at its new path after a move", async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await published("seramik", "Seramik kupalar", words("seramik", 320))
      const listed = async () =>
        (await buildSitemap(getContainer()))?.files.some((file) =>
          file.content.includes("/kategori/ev/seramik")
        )

      // The page itself does not change with its category: its new path is announced all the same
      const since = new Date()
      await kit.post(`/admin/product-categories/${kit.categoryId}`, { handle: "ev" })
      expect(await listed()).toBe(true)
      expect(await changedPaths(getContainer(), since)).toContain("/kategori/ev/seramik")

      await kit.post(`/admin/product-categories/${kit.categoryId}`, { is_active: false })
      expect(await listed()).toBe(false)
      expect(await changedPaths(getContainer(), since)).not.toContain("/kategori/ev/seramik")
    })
  },
})
