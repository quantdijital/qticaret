import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface Groups {
  header: Section[]
  home: Section[]
  footer: Section[]
  product: Section[]
  category: Section[]
}

interface AdminLayout {
  layout: {
    draft: Groups
    is_default: boolean
    has_changes: boolean
    revision: number
    revisions: { revision: number }[]
  }
  message?: string
}

interface StoreLayout {
  layout: Groups
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

/** adr/0049: the theme editor's draft, its preview and its publications. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("starts from the default design, keeps drafts apart, previews, publishes and goes back", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const admin = async () =>
        (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))).data.layout
      const live = async () =>
        (
          await settle(
            http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
          )
        ).data.layout
      const save = (home: Section[], extra: Record<string, unknown> = {}) =>
        settle(
          http.post<AdminLayout>(
            "/admin/storefront-layout",
            { document: { header: [], home, footer: [], ...extra } },
            asOwner
          )
        )
      const action = (path: string) =>
        settle(http.post<AdminLayout>(`/admin/storefront-layout/${path}`, {}, asOwner))
      await settle(
        http.post(
          "/admin/platform-settings/store",
          { contact_phone: "0532 123 45 67", contact_email: "destek@ornek.com" },
          asOwner
        )
      )
      await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { announcements: ["Bize {telefon} ile ulaşın"] },
          asOwner
        )
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

      // Never saved: the default design, today's storefront
      const first = await admin()
      expect(first.is_default).toBe(true)
      expect(first.draft.home.map((section) => section.type)).toEqual([
        "hero",
        "categories",
        "products",
        "help",
        "posts",
      ])
      // Only the main sections, read in (adr/0049 Ek 2026-11-14 §7)
      expect(
        [first.draft.product, first.draft.category].map((group) => group.map((each) => each.type))
      ).toEqual([["product_main"], ["category_main"]])
      const defaultLive = await live()
      expect([defaultLive.product, defaultLive.category]).toEqual([[], []])
      expect(defaultLive.header).toEqual([
        { id: "duyurular", type: "announcement_bar", lines: ["Bize 0532 123 45 67 ile ulaşın"] },
      ])
      expect(defaultLive.footer.map((section) => section.type)).toEqual(["newsletter"])

      const hero: Section = {
        id: "girisbolumu",
        type: "hero",
        ...ALWAYS,
        eyebrow: "{e_posta}",
        heading: "Yeni sezon",
        text: null,
        links: [
          { kind: "category", target: category, label: null },
          { kind: "system", target: "shop", label: "Tümü" },
        ],
        image: null,
      }
      const unknownRecord = await save([
        {
          id: "urunrafi1",
          type: "products",
          ...ALWAYS,
          title: null,
          source: { kind: "manual", product_ids: ["prod_yok"] },
          limit: 4,
          more: null,
        },
      ])
      const notUploaded = await save([
        { ...hero, image: { url: "https://baska.example/resim.jpg", alt: null } },
      ])
      const misspelt = await save([{ ...hero, text: "{telfon}" }])
      const twice = await save([hero, { ...hero }])
      const ended = {
        id: "eskikampanya",
        type: "help",
        visible: true,
        starts_at: "2026-01-01T00:00:00Z",
        ends_at: "2026-01-31T00:00:00Z",
        title: "Ocak kampanyası",
        text: null,
      }
      const saved = await save([hero, ended])

      expect(unknownRecord.status).toBe(400)
      expect(unknownRecord.data.message).toBe("storefront_layout.target_unknown")
      expect(notUploaded.status).toBe(400)
      expect(misspelt.status).toBe(400)
      expect(twice.status).toBe(400)
      expect(saved.status).toBe(200)
      expect(saved.data.layout).toMatchObject({ is_default: false, has_changes: true, revision: 0 })
      // A draft reaches no shopper
      expect((await live()).home.map((section) => section.id)).toContain("yeniurunler")

      const preview = await action("preview")
      const token = (preview.data as unknown as { path: string }).path.split("/").pop() ?? ""
      const previewed = await settle(
        http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
          headers: store.headers,
        })
      )
      const forged = await settle(
        http.get(`/store/storefront-layout/preview/${token.slice(0, -2)}xx`, {
          headers: store.headers,
        })
      )
      expect(previewed.status).toBe(200)
      // The ended campaign is not shown; the hero's links are named as their targets are now
      expect(previewed.data.layout.home).toEqual([
        {
          id: "girisbolumu",
          type: "hero",
          eyebrow: "destek@ornek.com",
          heading: "Yeni sezon",
          text: null,
          links: [
            {
              label: "Çakılar",
              kind: "category",
              target: category,
              path: expect.any(String) as unknown,
            },
            { label: "Tümü", kind: "system", target: "shop", path: null },
          ],
          image: null,
        },
      ])
      expect(forged.status).toBe(404)
      // A link of one kind opens nothing of another (security review 2026-11-02)
      const asContent = await settle(
        http.get(`/store/content/preview/${token.replace(/^sfl_/, "cnt_")}`, {
          headers: store.headers,
        })
      )
      const contentToken = await settle(
        http.get(`/store/storefront-layout/preview/${token.replace(/^sfl_/, "cnt_")}`, {
          headers: store.headers,
        })
      )
      expect([asContent.status, contentToken.status]).toEqual([404, 404])

      const published = await action("publish")
      expect(published.data.layout).toMatchObject({ revision: 1, has_changes: false })
      // Publishing saves the record: the draft's link made before is spent
      const afterPublish = await settle(
        http.get(`/store/storefront-layout/preview/${token}`, { headers: store.headers })
      )
      expect(afterPublish.status).toBe(404)
      expect((await live()).home.map((section) => section.id)).toEqual(["girisbolumu"])
      // Saved again, the earlier preview link no longer opens
      await save([hero])
      const stale = await settle(
        http.get(`/store/storefront-layout/preview/${token}`, { headers: store.headers })
      )
      expect(stale.status).toBe(404)

      const discarded = await action("discard")
      expect(discarded.data.layout.has_changes).toBe(false)
      expect(discarded.data.layout.draft.home.map((section) => section.id)).toEqual([
        "girisbolumu",
        "eskikampanya",
      ])

      await save([{ ...hero, heading: "İkinci sürüm" }])
      await action("publish")
      const restored = await action("revisions/1/restore")
      const gone = await action("revisions/9/restore")
      expect(restored.data.layout).toMatchObject({ revision: 2, has_changes: true })
      expect(restored.data.layout.draft.home[0]?.["heading"]).toBe("Yeni sezon")
      expect(restored.data.layout.revisions.map((each) => each.revision)).toEqual([2, 1])
      expect(gone.status).toBe(404)
    })

    it("keeps the product and category pages' sections: live records only, details filled, in place", async () => {
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
      const liveProduct = await product("Kamp Bıçağı", "published")
      const draftProduct = await product("Taslak Bıçak", "draft")
      const save = (groups: Partial<Groups>) =>
        settle(
          http.post<AdminLayout>(
            "/admin/storefront-layout",
            { document: { header: [], home: [], footer: [], ...groups } },
            asOwner
          )
        )
      const related = (source: Record<string, unknown>): Section => ({
        id: "benzerurunler",
        type: "related_products",
        ...ALWAYS,
        title: "Bunlara da bakın",
        source,
        limit: 4,
        columns: 5,
      })
      // On the tinted well, no gap above (its look, adr/0049 Ek 2026-11-14 §6)
      const faq: Section = {
        id: "sikcasorulan",
        type: "faq",
        ...ALWAYS,
        title: null,
        items: [{ question: "Size nasıl ulaşırım?", answer: "{telefon} numarasından arayın." }],
        look: { ground: "well", space_outer: "none" },
      }
      const intro: Section = {
        id: "kategorigiris",
        type: "rich_text",
        ...ALWAYS,
        title: null,
        body: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Danışın: {telefon}" }] }],
        },
        placement: "top",
      }
      // Drawn as GB4's lined boxes (adr/0049 Ek 2026-11-14); the product page's without a variant
      const trust: Section = { id: "guvencealt", type: "trust_badges", ...ALWAYS, variant: "lined" }
      const productTrust: Section = { id: "urunguven", type: "trust_badges", ...ALWAYS }

      const noCollection = await save({
        product: [related({ kind: "collection", collection_id: "pcol_yok" })],
      })
      const wrongPage = await save({ category: [related({ kind: "same_category" })] })
      const unknownVariant = await save({ category: [{ ...trust, variant: "bento" }] })
      const unknownStep = await save({ product: [{ ...faq, look: { ground: "red" } }] })
      const saved = await save({
        product: [
          related({ kind: "manual", product_ids: [liveProduct, draftProduct] }),
          faq,
          productTrust,
        ],
        category: [intro, trust],
      })

      expect(noCollection.status).toBe(400)
      expect(noCollection.data.message).toBe("storefront_layout.target_unknown")
      expect(wrongPage.status).toBe(400)
      expect(wrongPage.data.message).toContain("storefront_layout.section_invalid")
      expect(unknownVariant.status).toBe(400)
      expect(unknownVariant.data.message).toContain("storefront_layout.section_invalid")
      expect(unknownStep.status).toBe(400)
      expect(unknownStep.data.message).toContain("storefront_layout.section_invalid")
      expect(saved.status).toBe(200)
      expect(saved.data.layout).toMatchObject({ is_default: false, has_changes: true })
      // A category page's section without a place goes below the grid
      // (the category grid, read in first, takes no place)
      expect(saved.data.layout.draft.category.map((each) => each["placement"])).toEqual([
        undefined,
        "top",
        "bottom",
      ])
      // No variant saved: the default, today's strip (after the product's block, read in)
      expect(saved.data.layout.draft.product[3]).toMatchObject({ variant: "strip" })

      const preview = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = preview.data.path.split("/").pop() ?? ""
      const previewed = await settle(
        http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
          headers: store.headers,
        })
      )
      expect(previewed.status).toBe(200)
      const { layout } = previewed.data
      expect(layout.home).toEqual([])
      // The draft product's id never leaves the backend
      expect(layout.product).toEqual([
        {
          id: "benzerurunler",
          type: "related_products",
          title: "Bunlara da bakın",
          source: { kind: "manual", product_ids: [liveProduct] },
          limit: 4,
          // The shop's cards in a row reach the storefront (adr/0049 Ek 2026-11-05)
          columns: 5,
        },
        {
          id: "sikcasorulan",
          type: "faq",
          title: null,
          items: [
            { question: "Size nasıl ulaşırım?", answer: "0532 123 45 67 numarasından arayın." },
          ],
          // The steps the shop set reach the storefront, the others the theme's own
          look: {
            space_outer: "none",
            space_inner: null,
            ground: "well",
            align: null,
            width: null,
          },
        },
        // A section the shop left to the theme prints no look, as before looks
        { id: "urunguven", type: "trust_badges", variant: "strip" },
      ])
      expect(layout.category).toEqual([
        {
          id: "kategorigiris",
          type: "rich_text",
          title: null,
          html: expect.stringContaining("Danışın: 0532 123 45 67") as unknown,
          placement: "top",
        },
        { id: "guvencealt", type: "trust_badges", variant: "lined", placement: "bottom" },
      ])

      const published = await settle(
        http.post<AdminLayout>("/admin/storefront-layout/publish", {}, asOwner)
      )
      expect(published.data.layout).toMatchObject({ revision: 1, has_changes: false })
      expect(published.data.layout.draft.product.map((each) => each.id)).toEqual([
        "mainproduct",
        "benzerurunler",
        "sikcasorulan",
        "urunguven",
      ])
    })

    it("features one live product on the home page, its line's details filled (adr/0046 Ek 2026-11-05)", async () => {
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
      const live = await product("Şef Bıçağı", "published")
      const draft = await product("Taslak Şef", "draft")
      const featured = (id: string, productId: string): Section => ({
        id,
        type: "featured_product",
        ...ALWAYS,
        title: "Yakından",
        text: "Sorularınız için {telefon}",
        product_id: productId,
      })
      const save = (home: Section[]) =>
        settle(
          http.post<AdminLayout>(
            "/admin/storefront-layout",
            { document: { header: [], home, footer: [], product: [], category: [] } },
            asOwner
          )
        )

      const unknown = await save([featured("yakinyok1", "prod_yok")])
      const saved = await save([featured("yakincanli", live), featured("yakintaslak", draft)])
      expect(unknown.status).toBe(400)
      expect(unknown.data.message).toBe("storefront_layout.target_unknown")
      expect(saved.status).toBe(200)

      // The draft as the storefront shows it (a publication's is held a minute per revision)
      const preview = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = preview.data.path.split("/").pop() ?? ""
      const shown = await settle(
        http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
          headers: store.headers,
        })
      )
      // The draft's close-up is left out: its id never leaves the backend
      expect(shown.data.layout.home).toEqual([
        {
          id: "yakincanli",
          type: "featured_product",
          title: "Yakından",
          text: "Sorularınız için 0532 123 45 67",
          product_id: live,
        },
      ])
    })
  },
})
