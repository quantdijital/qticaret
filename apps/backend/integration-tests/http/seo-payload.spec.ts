import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Seo {
  jsonLd: Record<string, unknown>[]
  title: string
  description: string
  canonical: string | null
  robots: string
  breadcrumbs: { name: string; url: string }[]
  openGraph: { type: string; url: string | null }
}

interface Answer {
  type: string
  location?: string
  seo?: Seo | null
}

/** F3.4b (adr/0015): a live page's `seo` object in the resolve answer, fresh after every change. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const resolve = async (path: string) =>
      (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data

    // Changes reach the answer through events, after the request answers
    async function settled(path: string, until: (answer: Answer) => boolean) {
      let answer = await resolve(path)
      for (let attempt = 0; attempt < 30 && !until(answer); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        answer = await resolve(path)
      }
      return answer
    }

    async function catalog() {
      const category = async (name: string, parent?: string) =>
        (
          await post<{ product_category: { id: string } }>("/admin/product-categories", {
            name,
            is_active: true,
            ...(parent ? { parent_category_id: parent } : {}),
          })
        ).data.product_category.id
      const giyim = await category("Giyim")
      const gomlek = await category("Gömlek", giyim)
      const { data } = await post<{ product: { id: string } }>("/admin/products", {
        title: "Keten Gömlek",
        description: "<p>Yıkanmış ketenden rahat kesim gömlek. Yaz için ideal.</p>",
        status: "published",
        weight: 250,
        length: 30,
        width: 5,
        height: 2,
        categories: [{ id: gomlek }],
        options: [{ title: "Beden", values: ["S", "M"] }],
        variants: ["S", "M"].map((size, index) => ({
          title: size,
          options: { Beden: size },
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: index === 0 ? 899 : 999 }],
        })),
      })
      return { productId: data.product.id, giyim, gomlek }
    }

    // The settings cache outlives the database reset between tests: always set back
    async function withHost(run: () => Promise<void>) {
      await post("/admin/platform-settings/seo", { canonical_host: "magaza.example.com" })
      try {
        await run()
      } finally {
        await post("/admin/platform-settings/seo", { canonical_host: null })
      }
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("gives a product page its seo object from the templates and its category trail", async () => {
      await catalog()
      await withHost(async () => {
        const answer = await resolve("/urun/keten-gomlek")
        expect(answer.type).toBe("entity")
        expect(answer.seo).toMatchObject({
          description:
            // The shipping sentence from the default delivery days (F7.8)
            "Yıkanmış ketenden rahat kesim gömlek. Yaz için ideal. 899,00 TL'den başlayan fiyatlarla. 1–2 iş gününde kargoda.",
          canonical: "https://magaza.example.com/urun/keten-gomlek",
          robots: "index,follow",
          openGraph: { type: "product", url: "https://magaza.example.com/urun/keten-gomlek" },
          breadcrumbs: [
            { name: "Giyim", url: "https://magaza.example.com/kategori/giyim" },
            { name: "Gömlek", url: "https://magaza.example.com/kategori/giyim/gomlek" },
            { name: "Keten Gömlek", url: "https://magaza.example.com/urun/keten-gomlek" },
          ],
        })
        expect(answer.seo?.title.startsWith("Keten Gömlek |")).toBe(true)

        // F3.12: the product's group with an offer per size, and its breadcrumbs
        const [group, crumbs] = answer.seo?.jsonLd ?? []
        expect(group).toMatchObject({ "@type": "ProductGroup", productGroupID: "keten-gomlek" })
        // Both variants were made in one call: their order is not the point here
        const variants = (group as { hasVariant: { name: string; offers: { price: string } }[] })
          .hasVariant
        expect(variants.map((variant) => [variant.name, variant.offers.price]).sort()).toEqual([
          ["Keten Gömlek – M", "999.00"],
          ["Keten Gömlek – S", "899.00"],
        ])
        expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" })

        const listing = await resolve("/kategori/giyim/gomlek")
        expect(listing.seo?.jsonLd[0]).toMatchObject({
          "@type": "CollectionPage",
          mainEntity: {
            itemListElement: [{ position: 1, url: "https://magaza.example.com/urun/keten-gomlek" }],
          },
        })
        const site = await http.get<{ jsonLd: { "@type": string }[] }>("/store/seo/site", {
          headers: store.headers,
        })
        expect(site.data.jsonLd.map((block) => block["@type"])).toEqual(["OnlineStore", "WebSite"])
      })
    })

    it("answers at once after the page's own fields, its handle or a rule change", async () => {
      const { productId } = await catalog()
      // No host: no canonical, and no structured data (it needs absolute URLs)
      expect((await resolve("/urun/keten-gomlek")).seo).toMatchObject({
        canonical: null,
        jsonLd: [],
      })

      await http.put(
        `/admin/seo/product/${productId}`,
        { seo_title: "Keten Gömlek | Yazlık", robots_override: "noindex_follow" },
        { headers: admin.headers }
      )
      expect((await resolve("/urun/keten-gomlek")).seo).toMatchObject({
        title: "Keten Gömlek | Yazlık",
        robots: "noindex,follow",
      })

      await post(`/admin/products/${productId}`, { handle: "keten-gomlek-yazlik" })
      const moved = await settled("/urun/keten-gomlek", (answer) => answer.type === "redirect")
      expect(moved).toMatchObject({ type: "redirect", location: "/urun/keten-gomlek-yazlik" })

      await post("/admin/seo/redirects", { source: "/yaz", target: "/urun/keten-gomlek-yazlik" })
      expect(await resolve("/yaz")).toMatchObject({ type: "redirect" })
    })

    it("titles a category from its template", async () => {
      await catalog()
      const answer = await resolve("/kategori/giyim/gomlek")
      expect(answer.seo?.title.startsWith("Gömlek Modelleri ve Fiyatları")).toBe(true)
      expect(answer.seo?.breadcrumbs.map(({ name }) => name)).toEqual(["Giyim", "Gömlek"])
    })
  },
})
