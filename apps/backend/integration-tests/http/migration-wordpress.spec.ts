import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { serverErrorMessage } from "../../src/lib/errors/messages"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { readZipSafely } from "../../src/lib/security/zip"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

type Counts = Record<string, Record<string, number>>

/** adr/0042 Ek 2026-11-03: a WordPress + WooCommerce site moved in from its export (WXR). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled, fileBytes } = sheetClient(http, getContainer, () => owner.headers)
    let server: Server
    // The old site, serving its media library's pictures (the fake origin reached directly)
    let site = ""
    const pictures: string[] = []

    const start = (body: Buffer, query: string, type = "application/xml") =>
      settle(
        http.post<{ async_job: SheetJob; message?: string }>(
          `/admin/migrations?source=wordpress&${query}`,
          body,
          { headers: { ...owner.headers, "content-type": type } }
        )
      )
    const run = async (mode: "check" | "apply") => {
      const queued = await start(Buffer.from(wxrFixture(site)), `mode=${mode}`)
      expect(queued.status).toBe(202)
      const job = await settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return { job, counts: (job.result_summary as { counts: Counts }).counts }
    }
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    beforeAll(async () => {
      const png = await sharp({
        create: { width: 40, height: 40, channels: 3, background: "#b03a2e" },
      })
        .png()
        .toBuffer()
      server = createServer((req, res) => {
        const path = req.url ?? ""
        if (path.startsWith("/wp-content/uploads/") && path.endsWith(".png")) {
          pictures.push(path.split("/").pop() ?? "")
          res.writeHead(200, { "content-type": "image/png" })
          res.end(png)
          return
        }
        res.writeHead(404)
        res.end()
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
      site = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
      process.env["SHOPIFY_BASE_URL"] = site
    })

    afterAll(async () => {
      Reflect.deleteProperty(process.env, "SHOPIFY_BASE_URL")
      await new Promise((resolve) => server.close(resolve))
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
    })

    it("checks, applies and applies again without making anything twice (KK2)", async () => {
      // The shop's template has a field for one of the export's attributes (a product's own `malzeme`)
      const template = await http.post<{ attribute_template: { id: string } }>(
        "/admin/attribute-templates",
        {
          name: "Ev eşyası",
          handle: "ev-esyasi",
          definitions: [
            {
              key: "malzeme",
              label: "Malzeme",
              type: "multi_select",
              options: [
                { value: "kayin", label: "Kayın" },
                { value: "ceviz", label: "Ceviz" },
              ],
            },
          ],
        },
        { headers: owner.headers }
      )
      expect(template.status).toBe(200)

      const checked = await run("check")
      expect(checked.counts).toMatchObject({
        // One with its SEO plugin's own title and description, one on the shop's templates
        category: { read: 2, created: 2, seo_own: 1, seo_default: 1 },
        brand: { read: 1, created: 1 },
        product: { read: 4, created: 4, skipped: 0, failed: 0 },
        // `malzeme` written; `pa_desen` has no field, `pa_malzeme`'s value is no choice of it
        attribute: { read: 3, created: 1, skipped: 2 },
        image: { read: 3, created: 3 },
        review: { read: 2, created: 2 },
        post_category: { read: 1, created: 1, seo_own: 1, seo_default: 0 },
        post_tag: { read: 2, created: 2 },
        post: { read: 1, created: 1 },
        // Two with their own text; the legal and the cart pages keep their addresses only
        page: { read: 4, created: 2, skipped: 2 },
      })
      // The panel's block: the descriptive attributes by slug, what the export holds that does not move
      expect((checked.job.result_summary as { wordpress?: unknown }).wordpress).toEqual({
        attributes: [
          { key: "malzeme", name: "Malzeme", products: 2, values: 3 },
          { key: "desen", name: "Desen", products: 1, values: 1 },
        ],
        not_moved: { coupons: 1, menu_items: 1, product_tags: 1, blog_comments: 0 },
      })
      // The report names what stayed behind, in the shop's words
      const entries = await readZipSafely(await fileBytes(checked.job))
      const notes = entries.find((entry) => entry.name === "xl/worksheets/sheet3.xml")
      const text = notes?.data.toString("utf8") ?? ""
      for (const [key, record] of [
        ["migration.wordpress_page_legal", "page:51"],
        ["migration.wordpress_trashed", "product:32"],
        ["migration.wordpress_image_missing", "product:10 #999"],
        // With its values and their products, for a template made later
        ["migration.wordpress_attribute_not_moved", "Çizgili (1)"],
        ["catalog_import.attribute_invalid", "Döküm Demir (1)"],
      ] as const) {
        expect(text).toContain(record)
        expect(text).toContain(serverErrorMessage(key, "tr").slice(0, 30))
      }
      const summary = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml")
      expect(summary?.data.toString("utf8")).toContain("Mağazanın şablonlarıyla (varsayılan)")
      const nothing = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: "dokum-tava" },
      })
      expect(nothing.data).toHaveLength(0)

      const applied = await run("apply")
      expect(applied.counts).toMatchObject({
        category: { created: 2, seo_own: 1, seo_default: 1 },
        brand: { created: 1 },
        product: { created: 4, failed: 0 },
        attribute: { read: 3, created: 1, skipped: 2 },
        image: { read: 3, created: 3 },
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
            images: { url: string }[]
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
        "mutfak-sef",
        "tavalar",
      ])
      expect(pan?.variants.map((variant) => variant.sku).sort()).toEqual(["TAVA-K-24", "TAVA-M-28"])
      expect(pan?.options.map((option) => option.title).sort()).toEqual(["Boyut", "Renk"])
      // Its three pictures stored here, the main one its thumbnail, the old alt text kept
      expect(pan?.images).toHaveLength(3)
      expect(pan?.thumbnail?.startsWith(site)).toBe(false)
      expect(pictures.sort()).toEqual(["kapak.png", "kirmizi.png", "tava-yan.png", "tava.png"])
      const [main] = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ url: pan?.thumbnail ?? "" })
      expect(main?.alt).toBe("Döküm tava önden")
      // No parcel in the source and none given: live there, a draft here; hidden and drafts stay drafts
      expect(
        ["ahsap-kasik", "gizli-urun", "taslak-urun"].map((h) => byHandle.get(h)?.status)
      ).toEqual(["draft", "draft", "draft"])
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
        filters: { handle: ["mutfak-sef", "tavalar"] },
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
      expect(categorySeo.get("mutfak-sef")).toBeNull()

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
      expect(post?.image_url?.startsWith(site)).toBe(false)
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

      const again = await run("apply")
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
      expect(pictures).toHaveLength(4)
    })

    it("refuses a file that is no WordPress export, and keeps none it read", async () => {
      const refused = await start(Buffer.from('{"format":"quant-migration"}'), "mode=check")
      expect(refused.status).toBe(400)
      expect(
        (await start(Buffer.from(wxrFixture(site)), "mode=check&category_base=a/b/c")).status
      ).toBe(400)

      const broken = await start(
        Buffer.from(wxrFixture(site).replace("<wp:wxr_version>1.2</wp:wxr_version>", "")),
        "mode=check"
      )
      expect(broken.status).toBe(202)
      const job = await settled(broken.data.async_job.id)
      expect(job).toMatchObject({ status: "failed", error_code: "migration.wordpress_invalid" })
      // The export names the shop's commenters: gone however the run ended
      const [stored] = await getContainer()
        .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
        .listAsyncJobs({ id: job.id }, { select: ["input"] })
      const fileId = (stored?.input as { source_file_id: string }).source_file_id
      expect(fileId).toContain("migration-wordpress-")
      await expect(getContainer().resolve(Modules.FILE).getAsBuffer(fileId)).rejects.toThrow()
    })
  },
})
