import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ContentDoc } from "../../src/lib/content/doc"
import { docHrefs } from "../../src/lib/content/links"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import type { HttpClient } from "../helpers/http"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

/**
 * adr/0042 Ek 2026-11-03: a WordPress + WooCommerce export applied, and
 * applied again without making anything twice (KK2). The check alone:
 * `migration-wordpress.spec.ts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    it("applies and applies again without making anything twice (KK2)", async () => {
      await wp.makeTemplate()

      const applied = await wp.run("apply")
      expect(applied.counts).toMatchObject({
        category: { created: 2, seo_own: 1, seo_default: 1 },
        brand: { created: 1 },
        product: { created: 4, failed: 0 },
        attribute: { read: 3, created: 1, skipped: 2 },
        // The products' three and the picture in the post's text (adr/0042 Ek 2026-11-27)
        image: { read: 4, created: 4 },
        review: { created: 2 },
        post_category: { created: 1 },
        post_tag: { created: 2 },
        post: { created: 1 },
        page: { created: 2, skipped: 2 },
      })

      const { data: products } = await query().graph({
        entity: "product",
        fields: [
          "handle",
          "status",
          "weight",
          "thumbnail",
          "images.url",
          "images.variants.sku",
          "categories.handle",
          "variants.sku",
          "options.title",
          "seo_meta.seo_description",
          "seo_meta.focus_keyword",
          "attribute_template.handle",
          "attribute_values.value_options",
          "attribute_values.definition.key",
        ],
        filters: { handle: ["dokum-tava", "ahsap-kasik", "gizli-urun", "taslak-urun"] },
      })
      const byHandle = new Map(
        (
          products as {
            handle: string
            status: string
            weight: number | null
            thumbnail: string | null
            images: { url: string; variants?: { sku: string | null }[] | null }[]
            categories: { handle: string }[]
            variants: { sku: string | null }[]
            options: { title: string }[]
            seo_meta: { seo_description: string | null; focus_keyword: string | null } | null
            attribute_template: { handle: string } | null
            attribute_values:
              { value_options: string[] | null; definition: { key: string } | null }[] | null
          }[]
        ).map((product) => [product.handle, product])
      )
      const pan = byHandle.get("dokum-tava")
      expect(pan).toMatchObject({
        status: "published",
        weight: 1500,
        seo_meta: { seo_description: "Ağır döküm tava & kapak.", focus_keyword: "döküm tava" },
      })
      expect(pan?.categories.map((category) => category.handle).sort()).toEqual([
        "mutfak",
        "tavalar",
      ])
      expect(pan?.variants.map((variant) => variant.sku).sort()).toEqual(["TAVA-K-24", "TAVA-M-28"])
      expect(pan?.options.map((option) => option.title).sort()).toEqual(["Boyut", "Renk"])
      // Its three pictures stored here, the main one its thumbnail, the old alt text kept
      expect(pan?.images).toHaveLength(3)
      expect(pan?.thumbnail?.startsWith(wp.site())).toBe(false)
      // And the picture in the post's text (adr/0042 Ek 2026-11-27)
      expect(wp.pictures.sort()).toEqual([
        "kapak.png",
        "kirmizi.png",
        "tava-yan.png",
        "tava.png",
        "x.png",
      ])
      // The red variation's own picture shows with its variant only; the others with every one
      expect(
        pan?.images.map((image) => (image.variants ?? []).map((variant) => variant.sku).join())
      ).toEqual(expect.arrayContaining(["", "", "TAVA-K-24"]))
      expect(pan?.images.filter((image) => (image.variants ?? []).length > 0)).toHaveLength(1)
      const [main] = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ url: pan?.thumbnail ?? "" })
      expect(main?.alt).toBe("Döküm tava önden")
      // No parcel in the source and none given: live there, live here (adr/0054, the
      // default parcel ships it); hidden and drafts stay drafts
      expect(
        ["ahsap-kasik", "gizli-urun", "taslak-urun"].map((h) => byHandle.get(h)?.status)
      ).toEqual(["published", "draft", "draft"])
      // The descriptive attribute the template has a field for, through the catalog import
      const spoon = byHandle.get("ahsap-kasik")
      expect(spoon?.attribute_template?.handle).toBe("ev-esyasi")
      expect(
        spoon?.attribute_values?.map((value) => [value.definition?.key, value.value_options])
      ).toEqual([["malzeme", ["kayin", "ceviz"]]])
      expect(pan?.attribute_template ?? null).toBeNull()

      // A category's own SEO fields from its term meta; one without them on the shop's templates
      const { data: categories } = await query().graph({
        entity: "product_category",
        fields: [
          "handle",
          "seo_meta.seo_title",
          "seo_meta.seo_description",
          "seo_meta.focus_keyword",
        ],
        filters: { handle: ["mutfak", "tavalar"] },
      })
      const categorySeo = new Map(
        (
          categories as {
            handle: string
            seo_meta?: { seo_title: string | null } | null
          }[]
        ).map((category) => [category.handle, category.seo_meta ?? null])
      )
      expect(categorySeo.get("tavalar")).toMatchObject({
        seo_title: "Tavalar Modelleri - Örnek Ev & Mutfak",
        seo_description: "Her ocağa uygun döküm tavalar.",
        focus_keyword: "döküm tava",
      })
      expect(categorySeo.get("mutfak")).toBeNull()

      const content = getContainer().resolve<ContentModuleService>(CONTENT_MODULE)
      const [post] = await content.listContentEntries({ kind: "post", handle: "tava-bakimi" })
      expect(post).toMatchObject({
        title: "Tava Bakımı",
        status: "published",
        author_name: "Örnek Yazar",
        excerpt: "Tavanızı uzun yıllar kullanın.",
        image_alt: "Tava bakımı kapak",
      })
      expect(new Date(post?.published_at ?? 0).toISOString()).toBe("2024-03-01T07:30:00.000Z")
      expect(post?.image_url?.startsWith(wp.site())).toBe(false)
      // The picture in its text stored here, the text pointing at the copy with its alt
      const pictures = (post?.body as unknown as ContentDoc).content.filter(
        (block) => block.type === "image"
      )
      expect(pictures).toHaveLength(1)
      const [picture] = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({
          url: pictures.map((block) => (block as { attrs: { src: string } }).attrs.src),
        })
      expect(picture).toBeDefined()
      expect(pictures[0]).toMatchObject({ attrs: { alt: "x" } })
      const links = await content.listContentEntryTerms({ entry_id: post?.id ?? "" })
      const terms = await content.listContentTerms({ id: links.map((link) => link.term_id) })
      expect(terms.map((term) => `${term.kind}:${term.handle}`).sort()).toEqual([
        "category:rehberler",
        "tag:bakim",
        "tag:dokum",
      ])
      const { data: postSeo } = await query().graph({
        entity: "content_entry",
        fields: ["seo_meta.seo_title"],
        filters: { id: post?.id ?? "" },
      })
      expect(postSeo).toMatchObject([
        { seo_meta: { seo_title: "Tava Bakımı Rehberi - Örnek Ev & Mutfak" } },
      ])
      const pages = await content.listContentEntries(
        { kind: "page", handle: ["hakkimizda", "eski-kampanya", "satis-sozlesmesi"] },
        { order: { handle: "ASC" } }
      )
      // Kept out of search there, a draft here; the legal text is no content page
      expect(pages.map((page) => [page.handle, page.status])).toEqual([
        ["eski-kampanya", "draft"],
        ["hakkimizda", "published"],
      ])

      const reviews = await getContainer()
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .listProductReviews({ origin: "migration" }, { order: { rating: "DESC" } })
      expect(reviews.map((review) => [review.rating, review.status, review.author_name])).toEqual([
        [5, "approved", "Ayşe Y."],
        [4, "pending", "Ayşe Y."],
      ])

      // The old addresses, tied to what each became; the legal text's waits for a decision
      const urls = await getContainer()
        .resolve<MigrationModuleService>(MIGRATION_MODULE)
        .listMigrationUrls({}, { select: ["path", "entity_type"] })
      const tied = new Map(urls.map((url) => [url.path, url.entity_type]))
      expect(tied.get("/urun/dokum-tava")).toBe("product")
      expect(tied.get("/mutfak/tavalar")).toBe("product_category")
      expect(tied.get("/marka/demirci")).toBe("brand")
      expect(tied.get("/tava-bakimi")).toBe("post")
      expect(tied.get("/category/rehberler")).toBe("post_category")
      expect(tied.get("/hakkimizda")).toBe("page")
      expect(tied.has("/satis-sozlesmesi")).toBe(true)
      expect(tied.get("/satis-sozlesmesi")).toBeNull()

      // adr/0042 Ek 2026-11-05: the records' old paths answer at once, and the moved post's
      // links to the old site point at the pages here (the product and brand's paths are the
      // same here; the category's moved under the URL style's prefix)
      const { data: oldCategory } = await http.get<{ resolution: { type: string } }>(
        `/admin/seo/resolve?path=${encodeURIComponent("/mutfak/tavalar")}`,
        { headers: wp.headers() }
      )
      expect(oldCategory.resolution.type).toBe("redirect")
      const postLinks = docHrefs(post?.body as unknown as ContentDoc)
      expect(postLinks).toEqual(expect.arrayContaining(["/urun/dokum-tava", "/marka/demirci"]))
      expect(postLinks).not.toContain("/mutfak/tavalar")
      expect(postLinks.some((href) => href.startsWith("/kategori/"))).toBe(true)
      expect(applied.job.result_summary).toMatchObject({
        links: { changed: 1, unresolved: 0 },
      })

      const again = await wp.run("apply")
      expect(again.counts).toMatchObject({
        category: { created: 0, found: 2 },
        brand: { created: 0, found: 1 },
        product: { created: 0, found: 4 },
        // Left as the shop keeps them now
        attribute: { read: 3, created: 0, found: 3 },
        image: { created: 0, found: 3 },
        review: { created: 0, found: 2 },
        post_category: { created: 0, found: 1 },
        post_tag: { created: 0, found: 2 },
        post: { created: 0, found: 1 },
        page: { created: 0, found: 2 },
      })
      expect(await content.listContentEntries({ kind: "post" })).toHaveLength(1)
      expect(await content.listContentTerms({})).toHaveLength(3)
      expect(wp.pictures).toHaveLength(4)
    })
  },
})
