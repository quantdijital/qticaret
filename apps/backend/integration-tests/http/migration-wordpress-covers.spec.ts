import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { CATALOG_EXTENSION_MODULE } from "../../src/modules/catalog-extension"
import type CatalogExtensionModuleService from "../../src/modules/catalog-extension/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import backfill from "../../src/scripts/category-covers-backfill"
import { setCategoryImageWorkflow } from "../../src/workflows/catalog/category-images"
import type { HttpClient } from "../helpers/http"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

const MUTFAK_FILE = "/wp-content/uploads/2026/01/mutfak.png"

/**
 * adr/0042 Ek 2026-11-06: a WooCommerce category's own picture (term meta
 * `thumbnail_id`) set as the category's picture here, its file stored
 * once (a product's picture used again), its old file's address kept for
 * its 301; a missing one a note. The backfill script does the same for a
 * shop moved before, never over the shop's own picture.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)

    const categoryIds = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product_category",
          fields: ["id", "handle"],
          filters: { handle: ["mutfak-sef", "tavalar", "kasiklar"] },
        })
      return new Map((data as { id: string; handle: string }[]).map((row) => [row.handle, row.id]))
    }
    const picturesOf = async () => {
      const ids = await categoryIds()
      const rows = await getContainer()
        .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
        .listCategoryImages({ category_id: [...ids.values()] })
      const handleOf = new Map([...ids].map(([handle, id]) => [id, handle]))
      return new Map(rows.map((row) => [handleOf.get(row.category_id), row]))
    }
    const fetched = (name: string) => wp.pictures.filter((each) => each === name).length

    it("sets the categories' pictures in a run, a product's file used again, and keeps them on a run again", async () => {
      const checked = await wp.run("check", { covers: true })
      expect(checked.counts["category"]).toMatchObject({
        read: 3,
        created: 3,
        covers: 2,
        covers_kept: 0,
        // The pan's picture comes with its product in the same run
        covers_reused: 1,
        covers_uploaded: 1,
        covers_failed: 1,
      })
      expect(wp.pictures).toHaveLength(0)

      const applied = await wp.run("apply", { covers: true })
      expect(applied.counts["category"]).toMatchObject({
        created: 3,
        covers: 2,
        covers_kept: 0,
        covers_reused: 1,
        covers_uploaded: 1,
        covers_failed: 1,
      })
      expect(applied.counts["image"]).toMatchObject({ read: 3, created: 3 })
      // Each file fetched once
      expect([fetched("tava.png"), fetched("mutfak.png")]).toEqual([1, 1])

      const pictures = await picturesOf()
      const [pan] = await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ alt: "Döküm tava önden" })
      expect(pictures.get("tavalar")).toMatchObject({ url: pan?.url, alt: "Döküm tava önden" })
      // Titled as its file: the category's name
      expect(pictures.get("mutfak-sef")).toMatchObject({ alt: "Mutfak & Şef" })
      expect(pictures.get("mutfak-sef")?.url.startsWith(wp.site())).toBe(false)
      // Its attachment missing from the media library: no picture, the run goes on
      expect(pictures.has("kasiklar")).toBe(false)

      // The cover's old file answers with its new address (adr/0059)
      const files = await getContainer()
        .resolve<MigrationModuleService>(MIGRATION_MODULE)
        .listMigrationFiles({ path: MUTFAK_FILE })
      expect(files).toHaveLength(1)
      const { data: old } = await http.get<{ resolution: { type: string; location?: string } }>(
        `/admin/seo/resolve?path=${encodeURIComponent(MUTFAK_FILE)}`,
        { headers: wp.headers() }
      )
      expect(old.resolution).toMatchObject({
        type: "redirect",
        location: pictures.get("mutfak-sef")?.url,
      })

      const again = await wp.run("apply", { covers: true })
      expect(again.counts["category"]).toMatchObject({
        covers: 0,
        covers_kept: 2,
        covers_reused: 0,
        covers_uploaded: 0,
        covers_failed: 1,
      })
      expect([fetched("tava.png"), fetched("mutfak.png")]).toEqual([1, 1])
    })

    it("backfills the pictures of a shop moved before, never over the shop's own (dry run first)", async () => {
      // Moved before the pictures were read: its categories have none
      await wp.run("apply")
      expect((await picturesOf()).size).toBe(0)
      const { data: products } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["thumbnail"], filters: { handle: "dokum-tava" } })
      const thumbnail = (products[0] as { thumbnail: string | null } | undefined)?.thumbnail ?? ""
      // The shop gave Tavalar a picture of its own since
      await setCategoryImageWorkflow(getContainer()).run({
        input: {
          category_id: (await categoryIds()).get("tavalar") ?? "",
          image: { url: thumbnail, alt: "Mağazanın görseli" },
        },
      })
      const before = wp.pictures.length

      const folder = await mkdtemp(path.join(tmpdir(), "category-covers-"))
      const file = path.join(folder, "export.xml")
      await writeFile(file, wxrFixture(wp.site(), { covers: true }))
      const lines: string[] = []
      const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(String(chunk))
        return true
      })
      const exec = async (args: string[]) => {
        await backfill({ container: getContainer(), args })
        return wp.pictures.length - before
      }
      const downloads: number[] = []
      try {
        downloads.push(await exec([file]))
        downloads.push(await exec([file, "apply"]))
        downloads.push(await exec([file, "apply"]))
      } finally {
        write.mockRestore()
        await rm(folder, { recursive: true, force: true })
      }
      const counts = lines
        .filter((line) => line.startsWith("category-covers:backfill"))
        .map((line) => JSON.parse(line.slice(line.indexOf("{"))) as Record<string, number>)
      const expected = {
        found: 3,
        set: 1,
        already_set: 1,
        reused_asset: 0,
        uploaded: 1,
        failed: 1,
      }
      // The dry run writes and fetches nothing
      expect(counts[0]).toEqual(expected)
      expect(lines.some((line) => line.includes("nothing written"))).toBe(true)
      expect(downloads[0]).toBe(0)
      expect(counts[1]).toEqual(expected)
      expect(downloads[1]).toBe(1)
      expect(lines).toContainEqual(
        "  FAILED product_cat:kasiklar #999: migration.wordpress_category_image_missing\n"
      )
      // Again: nothing to set, nothing fetched
      expect(counts[2]).toEqual({ ...expected, set: 0, already_set: 2, uploaded: 0 })
      expect(downloads[2]).toBe(1)

      const pictures = await picturesOf()
      expect(pictures.get("tavalar")).toMatchObject({ url: thumbnail, alt: "Mağazanın görseli" })
      expect(pictures.get("mutfak-sef")).toMatchObject({ alt: "Mutfak & Şef" })
      expect(
        await getContainer()
          .resolve<MigrationModuleService>(MIGRATION_MODULE)
          .listMigrationFiles({ path: MUTFAK_FILE })
      ).toHaveLength(1)
      const audit = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "migration.category_covers_set" })
      expect(audit).toHaveLength(2)
    })
  },
})
