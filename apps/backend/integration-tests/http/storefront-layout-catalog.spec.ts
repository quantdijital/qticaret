import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface StoreLayout {
  layout: { home: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const document = (home: Section[]) => ({
  document: { header: [], home, footer: [], product: [], category: [] },
})

/**
 * adr/0049 Ek 2026-11-14 (§3.2 H17 and the note "Katalog ana sayfası"):
 * the opening's category list, the category cards' counts and link, and
 * the price bands with their products picked on the server.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves the catalogue home page's sections and reads them with live records, links and picks", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const shop = await stockShop(container)
      const asOwner = { headers: owner.headers }
      const category = async (name: string) =>
        (
          await settle(
            http.post<{ product_category: { id: string } }>(
              "/admin/product-categories",
              { name, is_active: true },
              asOwner
            )
          )
        ).data.product_category.id
      const knives = await category("Çakılar")
      const swords = await category("Kılıçlar")
      const cheap = await stockedProduct(container, shop, "anahtarlik-caki", 5, 1)
      const dear = await stockedProduct(container, shop, "koleksiyon-kilic", 5, 99_999)
      await indexCatalogue(container)

      const opening = (more: Record<string, unknown> = {}): Section => ({
        id: "girisbolumu",
        type: "hero",
        ...ALWAYS,
        variant: "category_list",
        heading: "Elmax çakılar",
        links: [{ kind: "category", target: knives, label: "Çakıları gör" }],
        list: { kind: "manual", category_ids: [knives, swords] },
        list_limit: 6,
        show_count: true,
        tiles: [{ category_id: swords, image: null }],
        chips: [{ kind: "category", target: swords, label: null }],
        picks: [{ product_id: cheap.productId, label: "Yeşil" }],
        ...more,
      })
      const strip: Section = {
        id: "fiyatbantlari",
        type: "price_bands",
        ...ALWAYS,
        title: "Fiyata göre alışveriş",
        bands: [
          { label: "₺1 ve altı", max: 1 },
          { label: "₺2 altı", text: "Küçükler", max: 2 },
          { label: "Koleksiyonluk", max: null },
        ],
        thumbs: 4,
      }
      const cards: Section = {
        id: "celikler",
        type: "categories",
        ...ALWAYS,
        category_ids: [knives],
        show_count: true,
        more: { kind: "system", target: "categories", label: "Tüm çakılar" },
      }
      const save = (home: Section[]) =>
        settle(http.post<{ message?: string }>("/admin/storefront-layout", document(home), asOwner))

      const unknownTile = await save([
        opening({ tiles: [{ category_id: "pcat_yok", image: null }] }),
      ])
      const unknownPick = await save([
        opening({ picks: [{ product_id: "prod_yok", label: null }] }),
      ])
      const fallingBands = await save([
        {
          ...strip,
          bands: [
            { label: "Pahalı", max: 1000 },
            { label: "Ucuz", max: 500 },
          ],
        },
      ])
      const notStandard = await save([{ ...opening(), variant: "standard" }])
      const saved = await save([opening(), strip, cards])

      expect([unknownTile.status, unknownTile.data.message]).toEqual([
        400,
        "storefront_layout.target_unknown",
      ])
      expect([unknownPick.status, unknownPick.data.message]).toEqual([
        400,
        "storefront_layout.target_unknown",
      ])
      expect([fallingBands.status, fallingBands.data.message]).toEqual([
        400,
        "storefront_layout.price_bands_order",
      ])
      // Today's opening takes none of the list's fields
      expect(notStandard.status).toBe(400)
      expect(saved.status).toBe(200)

      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const live = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      const [hero, bands, tiles] = live.data.layout.home

      expect(hero).toMatchObject({
        id: "girisbolumu",
        type: "hero",
        variant: "category_list",
        list: { kind: "manual", category_ids: [knives, swords] },
        list_limit: 6,
        show_count: true,
        tiles: [{ category_id: swords, image: null }],
        chips: [{ kind: "category", target: swords, label: "Kılıçlar" }],
        picks: [{ product_id: cheap.productId, label: "Yeşil" }],
        show_price: true,
      })
      expect(tiles).toMatchObject({
        type: "categories",
        show_count: true,
        more: { kind: "system", target: "categories", label: "Tüm çakılar" },
      })
      const picked = (bands?.["bands"] ?? []) as { min: number | null; product_ids: string[] }[]
      expect(picked.map((band) => band.min)).toEqual([null, 1, 2])
      expect(picked[0]?.product_ids).toEqual([cheap.productId])
      expect(picked[1]?.product_ids).toEqual([])
      expect(picked[2]?.product_ids).toContain(dear.productId)
      expect(picked[2]?.product_ids).not.toContain(cheap.productId)
      expect(picked[2]?.product_ids.length).toBeLessThanOrEqual(4)
    })
  },
})
