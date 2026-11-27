import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { serverErrorMessage } from "../../src/lib/errors/messages"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { readZipSafely } from "../../src/lib/security/zip"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import type { HttpClient } from "../helpers/http"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

/**
 * adr/0042 Ek 2026-11-03: a WordPress + WooCommerce site moved in from its
 * export (WXR): the check counts and reports without writing, and a file
 * that is no export is refused. Applying it: `migration-wordpress-apply.spec.ts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    it("checks without writing: counts, the export's attributes and the notes (KK2)", async () => {
      await wp.makeTemplate()

      const checked = await wp.run("check")
      expect(checked.counts).toMatchObject({
        // One with its SEO plugin's own title and description, one on the shop's templates
        category: { read: 2, created: 2, seo_own: 1, seo_default: 1 },
        brand: { read: 1, created: 1 },
        product: { read: 4, created: 4, skipped: 0, failed: 0 },
        // `malzeme` written; `pa_desen` has no field, `pa_malzeme`'s value is no choice of it
        attribute: { read: 3, created: 1, skipped: 2 },
        // The products' three and the picture in the post's text (adr/0042 Ek 2026-11-27)
        image: { read: 4, created: 4 },
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
      const entries = await readZipSafely(await wp.fileBytes(checked.job))
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
    })

    it("refuses a file that is no WordPress export, and keeps none it read", async () => {
      const refused = await wp.start(Buffer.from('{"format":"quant-migration"}'), "mode=check")
      expect(refused.status).toBe(400)
      expect(
        (await wp.start(Buffer.from(wxrFixture(wp.site())), "mode=check&category_base=a/b/c"))
          .status
      ).toBe(400)

      const broken = await wp.start(
        Buffer.from(wxrFixture(wp.site()).replace("<wp:wxr_version>1.2</wp:wxr_version>", "")),
        "mode=check"
      )
      expect(broken.status).toBe(202)
      const job = await wp.settled(broken.data.async_job.id)
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
