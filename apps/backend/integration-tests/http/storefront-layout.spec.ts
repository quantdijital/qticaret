import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface AdminLayout {
  layout: {
    draft: { header: Section[]; home: Section[]; footer: Section[] }
    is_default: boolean
    has_changes: boolean
    revision: number
    revisions: { revision: number }[]
  }
  message?: string
}

interface StoreLayout {
  layout: { header: Section[]; home: Section[]; footer: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }

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
      const defaultLive = await live()
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
  },
})
