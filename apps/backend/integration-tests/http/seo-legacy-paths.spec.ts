import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import backfill from "../../src/scripts/legacy-backfill"
import type { HttpClient } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

interface Resolution {
  type: string
  status?: number
  location?: string
}

/**
 * adr/0059: an old WordPress site's own addresses (numbered pages, short
 * subcategory paths, archives, the media library's files, the home page's
 * query addresses, WordPress's machinery) answer `GET /store/seo/resolve`
 * with one 301 or a 410, only in a shop a WordPress migration moved into;
 * the backfill script writes the explicit entries for a shop moved before.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)
    let store: Storefront

    const resolve = async (raw: string) =>
      (
        await http.get<Resolution>(`/store/seo/resolve?path=${encodeURIComponent(raw)}`, {
          headers: store.headers,
        })
      ).data
    const location = async (raw: string) => {
      const answer = await resolve(raw)
      expect({ raw, type: answer.type, status: answer.status }).toEqual({
        raw,
        type: "redirect",
        status: 301,
      })
      return answer.location ?? ""
    }
    const post = (title: string) =>
      http.post(
        "/admin/content",
        {
          kind: "post",
          title,
          status: "published",
          body: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
          },
        },
        { headers: wp.headers() }
      )

    beforeEach(async () => {
      store = await createStorefront(getContainer())
    })

    it("has none of these rules in a shop that never moved from WordPress", async () => {
      for (const raw of ["/wp-login.php", "/2024/05", "/?p=40", "/feed", "/cart"]) {
        expect({ raw, type: (await resolve(raw)).type }).toEqual({ raw, type: "not_found" })
      }
    })

    it("answers the old site's own addresses with one 301, or a 410 where nothing fits", async () => {
      const applied = await wp.run("apply")
      // The explicit entries: the subcategory's short path, the three pictures and the cover
      expect(applied.job.result_summary).toMatchObject({ links: { short_paths: 1, files: 4 } })
      const category = await location("/mutfak/tavalar")
      expect(category).toMatch(/^\/kategori\//)

      // Short subcategory path, kept for its category like its full path
      expect(await location("/tavalar")).toBe(category)
      // Numbered pages: the list's page while it has one, else its first; the visitor's query kept
      expect(await location("/mutfak/tavalar/page/2?utm_source=x&orderby=price")).toBe(
        `${category}?utm_source=x`
      )
      expect(await location("/tavalar/page/3")).toBe(category)
      for (let n = 0; n < 12; n += 1) {
        await post(`Yazı ${String(n + 1)}`)
      }
      expect(await location("/blog/page/2")).toBe("/blog?sayfa=2")
      expect(await location("/blog/?paged=2")).toBe("/blog?sayfa=2")
      expect(await location("/blog/page/3")).toBe("/blog")
      expect(await location("/page/2")).toBe("/")
      expect(await location("/?paged=2")).toBe("/")

      // Archives: date and author to the blog, a kept blog tag to its archive, others to the blog
      expect(await location("/2024/03")).toBe("/blog")
      expect(await location("/2024/03/page/2")).toBe("/blog")
      expect(await location("/author/admin")).toBe("/blog")
      expect(await location("/tag/dokum")).toBe("/blog/etiket/dokum")
      expect(await location("/etiket/bakim")).toBe("/blog/etiket/bakim")
      expect(await location("/tag/olmayan")).toBe("/blog")
      expect(await location("/urun-etiketi/dokum-tava")).toBe("/arama?q=dokum+tava")

      // The home page's query addresses: the record's page today, a search, or gone
      expect(await location("/?p=40")).toBe("/blog/tava-bakimi")
      expect(await location("/?p=10&utm_source=x")).toBe("/urun/dokum-tava?utm_source=x")
      expect(await location("/?page_id=50")).toBe("/hakkimizda")
      expect(await location("/?product=dokum-tava")).toBe("/urun/dokum-tava")
      expect(await location("/?product_cat=tavalar")).toBe(category)
      expect(await location("/?s=tava")).toBe("/arama?q=tava")
      // A draft there is a draft here: not found until it is published; an id never moved: gone
      expect((await resolve("/?post_type=product&p=31")).type).toBe("not_found")
      expect((await resolve("/?p=999")).type).toBe("gone")

      // The media library: each moved picture's file and its sizes, the cover too; the rest gone
      const picture = await location("/wp-content/uploads/2026/01/tava.png")
      expect(picture).toMatch(/^https?:\/\//)
      expect(picture).not.toContain("/wp-content/")
      expect(await location("/wp-content/uploads/2026/01/tava-300x300.png")).toBe(picture)
      const [moved] = await getContainer()
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listContentEntries({ handle: "tava-bakimi" }, { select: ["image_url"] })
      expect(await location("/wp-content/uploads/2026/01/kapak.png")).toBe(moved?.image_url)
      expect((await resolve("/wp-content/uploads/2026/01/x.png")).type).toBe("gone")

      // WordPress's machinery is gone; WooCommerce's pages became the storefront's
      for (const raw of [
        "/wp-login.php",
        "/xmlrpc.php",
        "/wp-admin",
        "/feed",
        "/tava-bakimi/feed",
      ]) {
        expect({ raw, type: (await resolve(raw)).type }).toEqual({ raw, type: "gone" })
      }
      expect(await location("/cart")).toBe("/sepet")
      expect(await location("/my-account/orders")).toBe("/hesap/siparisler")
      // Attachment pages: the moved record's page today in one hop, never the image (`tava`
      // is a moved file's stem too), the visitor's query kept; `?attachment_id=` stays gone
      expect(await location("/urun/dokum-tava/tava/?utm_source=x")).toBe(
        "/urun/dokum-tava?utm_source=x"
      )
      expect(await location("/tava-bakimi/kapak")).toBe("/blog/tava-bakimi")
      expect(await location("/tava-bakimi/attachment/kapak/")).toBe("/blog/tava-bakimi")
      expect(await location("/hakkimizda/ekip")).toBe("/hakkimizda")
      expect((await resolve("/?attachment_id=101")).type).toBe("gone")
      // Under a category, a record never moved or nothing: no attachment page there
      for (const raw of ["/mutfak/tavalar/tava", "/blog/yazi-1/kapak", "/hic-olmayan/tava"]) {
        expect({ raw, type: (await resolve(raw)).type }).toEqual({ raw, type: "not_found" })
      }
      expect((await resolve("/blog/yazi-1")).type).toBe("entity")

      // A live page is never shadowed, nor a real nested path, nor a path WordPress never served
      expect((await resolve(category)).type).toBe("entity")
      expect((await resolve("/hakkimizda")).type).toBe("entity")
      expect((await resolve("/hic-olmayan")).type).toBe("not_found")
    })

    it("backfills the explicit entries for a shop moved before (dry run first)", async () => {
      await wp.run("apply")
      const migration = getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE)
      // As a run before adr/0059 left it: no files, no cover remembered
      const files = await migration.listMigrationFiles({}, { select: ["id"] })
      await migration.deleteMigrationFiles(files.map((file) => file.id))
      const covers = await migration.listMigrationItems(
        { kind: "image", source_key: { $like: "post:%" } },
        { select: ["id"] }
      )
      await migration.deleteMigrationItems(covers.map((item) => item.id))

      const folder = await mkdtemp(path.join(tmpdir(), "legacy-backfill-"))
      const file = path.join(folder, "export.xml")
      await writeFile(file, wxrFixture(wp.site()))
      const lines: string[] = []
      const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(String(chunk))
        return true
      })
      const exec = (args: string[]) => backfill({ container: getContainer(), args })
      try {
        await exec([file])
        await exec([file, "apply"])
        await exec([file])
      } finally {
        write.mockRestore()
        await rm(folder, { recursive: true, force: true })
      }
      const counts = lines
        .filter((line) => line.startsWith("legacy:backfill"))
        .map((line) => JSON.parse(line.slice(line.indexOf("{"))) as Record<string, unknown>)
      expect(counts[0]).toMatchObject({
        covers: { found: 1, added: 1 },
        short_paths: { found: 1, added: 0, known: 1 },
        files: { found: 3, added: 3 },
      })
      expect(lines.some((line) => line.includes("nothing written"))).toBe(true)
      expect(counts[1]).toMatchObject({
        covers: { found: 1, added: 1 },
        files: { found: 4, added: 4 },
      })
      expect(counts[2]).toMatchObject({ covers: { added: 0 }, files: { found: 4, added: 0 } })
      expect(await migration.listMigrationFiles({}, { select: ["id"] })).toHaveLength(4)
      expect(await location("/wp-content/uploads/2026/01/kapak.png")).toMatch(/^https?:\/\//)
    })
  },
})
