import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { THUMBNAIL_KIND } from "../../src/workflows/migration/thumbnail"
import type { HttpClient } from "../helpers/http"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

interface ProductRow {
  handle: string
  thumbnail: string | null
  metadata?: Record<string, unknown> | null
  images: { url: string; variants?: { sku: string | null }[] | null }[]
  variants: {
    sku: string | null
    manage_inventory: boolean
    inventory_items?:
      { inventory?: { location_levels?: { stocked_quantity: number }[] | null } | null }[] | null
  }[]
}

/**
 * adr/0042 Ek 2026-11-20, from a real shop's move: stock WooCommerce did
 * not count stays sellable, a shared pool is each variant's, categories
 * keep their slugs and never land on a switched-off demo category, and a
 * busy old host's pictures arrive after a wait, the featured one taking
 * its stand-in's place and the variant ties kept on a run again.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    const pan = async (): Promise<ProductRow | undefined> => {
      const { data } = await query().graph({
        entity: "product",
        fields: [
          "handle",
          "thumbnail",
          "metadata",
          "images.url",
          "images.variants.sku",
          "variants.sku",
          "variants.manage_inventory",
          "variants.inventory_items.inventory.location_levels.stocked_quantity",
        ],
        filters: { handle: ["dokum-tava", "ahsap-kasik"] },
      })
      return (data as ProductRow[]).find((product) => product.handle === "dokum-tava")
    }
    const variantsOf = async (handle: string) => {
      const { data } = await query().graph({
        entity: "product",
        fields: [
          "variants.sku",
          "variants.manage_inventory",
          "variants.inventory_items.inventory.location_levels.stocked_quantity",
        ],
        filters: { handle },
      })
      return new Map(
        ((data[0] as ProductRow | undefined)?.variants ?? []).map((variant) => [
          variant.sku,
          {
            tracked: variant.manage_inventory,
            stock:
              variant.inventory_items?.[0]?.inventory?.location_levels?.[0]?.stocked_quantity ??
              null,
          },
        ])
      )
    }

    it("keeps uncounted stock sellable and out-of-stock at 0", async () => {
      await wp.run("apply")
      expect(await variantsOf("ahsap-kasik")).toEqual(
        new Map([["KASIK-1", { tracked: false, stock: null }]])
      )
      expect(await variantsOf("dokum-tava")).toEqual(
        new Map([
          ["TAVA-K-24", { tracked: true, stock: 5 }],
          ["TAVA-M-28", { tracked: true, stock: 0 }],
        ])
      )
    })

    it("gives each variation the product's shared count", async () => {
      await wp.run("apply", { pooledStock: true })
      expect(await variantsOf("dokum-tava")).toEqual(
        new Map([
          ["TAVA-K-24", { tracked: true, stock: 5 }],
          ["TAVA-M-28", { tracked: true, stock: 9 }],
        ])
      )
    })

    it("takes the category slugs, past a switched-off empty demo category", async () => {
      // A demo category, switched off, with the WordPress category's name and slug
      await createProductCategoriesWorkflow(getContainer()).run({
        input: {
          product_categories: [
            {
              name: "Mutfak & Şef",
              handle: "mutfak",
              is_active: false,
              metadata: { demo: true, demo_catalog: "mutfak" },
            },
          ],
        },
      })
      const applied = await wp.run("apply")
      expect(applied.counts["category"]).toMatchObject({ created: 2, found: 0 })
      const { data } = await query().graph({
        entity: "product_category",
        fields: ["handle", "is_active", "metadata", "parent_category.handle"],
        filters: { handle: ["mutfak", "tavalar"] },
      })
      const categories = data as {
        handle: string
        is_active: boolean
        metadata: Record<string, unknown> | null
        parent_category: { handle: string } | null
      }[]
      expect(
        categories
          .map((category) => [
            category.handle,
            category.is_active,
            category.metadata?.["demo"] ?? null,
            category.parent_category?.handle ?? null,
          ])
          .sort()
      ).toEqual([
        ["mutfak", true, null, null],
        ["tavalar", true, null, "mutfak"],
      ])
    })

    it("waits out a busy host, swaps the featured picture in later, keeps variant ties", async () => {
      // The red picture is refused twice (a wait asked for, then a failing server) and then
      // served; the featured one is missing on the first run
      wp.refuse("kirmizi.png", { status: 429, retryAfter: "1" }, 503)
      wp.refuse("tava.png", 404)
      const first = await wp.run("apply")
      // The post's picture too (adr/0042 Ek 2026-11-27)
      expect(first.counts["image"]).toMatchObject({ read: 4, created: 3, skipped: 1 })
      const skipped = await getContainer()
        .resolve<MigrationModuleService>(MIGRATION_MODULE)
        .listMigrationItems({ kind: "image", status: "skipped" })
      expect(skipped.map((item) => item.error_code)).toEqual([
        "migration.image_unreachable_not_found",
      ])
      const before = await pan()
      const standIn = before?.thumbnail ?? null
      expect(standIn).not.toBeNull()
      // Recorded by the migration, never in the product's metadata (which the store API may return)
      const standIns = () =>
        getContainer()
          .resolve<MigrationModuleService>(MIGRATION_MODULE)
          .listMigrationItems({ kind: THUMBNAIL_KIND })
      expect((await standIns()).map((item) => [item.status, item.target_id])).toEqual([
        ["done", standIn],
      ])
      expect(Object.keys(before?.metadata ?? {}).some((key) => key.startsWith("migration"))).toBe(
        false
      )
      const tiedBefore = before?.images.filter((image) => (image.variants ?? []).length > 0)
      expect(tiedBefore?.map((image) => image.variants?.map((variant) => variant.sku))).toEqual([
        ["TAVA-K-24"],
      ])

      // A run again fetches the featured picture: it takes the stand-in's place, the tie stays
      const again = await wp.run("apply")
      expect(again.counts["image"]).toMatchObject({ created: 1, found: 2 })
      const after = await pan()
      expect(after?.images).toHaveLength(3)
      expect(after?.thumbnail).not.toBe(standIn)
      expect(after?.images.map((image) => image.url)).toContain(after?.thumbnail)
      expect((await standIns()).map((item) => item.status)).toEqual(["skipped"])
      expect(
        after?.images
          .filter((image) => (image.variants ?? []).length > 0)
          .map((image) => [image.url, image.variants?.map((variant) => variant.sku)])
      ).toEqual(tiedBefore?.map((image) => [image.url, ["TAVA-K-24"]]))
    })
  },
})
