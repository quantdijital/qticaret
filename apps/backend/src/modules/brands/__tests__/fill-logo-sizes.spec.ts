import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BRANDS_MODULE } from ".."
import type BrandsModuleService from "../service"
import { FILL_PAGE, fillLogoSizesPage } from "../../../workflows/brands/steps/fill-logo-sizes"
import type { measureLogo } from "../../../workflows/brands/logo-size"

jest.setTimeout(120 * 1000)

type Measure = typeof measureLogo

const logo = (key: string) => ({
  logo_file_id: `${key}.png`,
  logo_url: `https://cdn.example.com/${key}.png`,
})

/**
 * The backfill's page (marka logosu boyutu): written only where the brand
 * still has the logo that was measured and still no size, a page at a
 * time, and nothing a second time.
 */
moduleIntegrationTestRunner<BrandsModuleService>({
  moduleName: BRANDS_MODULE,
  resolve: "./src/modules/brands",
  testSuite: ({ service }) => {
    const container = { resolve: () => service } as never
    const wide: Measure = () => Promise.resolve({ width: 600, height: 200 })

    it("writes no size the brand's logo no longer has, nor over one a save gave", async () => {
      const changed = await service.createBrands({ name: "Ada", handle: "ada", ...logo("ada-1") })
      const sized = await service.createBrands({ name: "Bora", handle: "bora", ...logo("bora-1") })
      const kept = await service.createBrands({ name: "Cem", handle: "cem", ...logo("cem-1") })
      // While the files are read, a save changes Ada's logo and sizes Bora's
      const racing: Measure = async (_container, fileId) => {
        if (fileId === "ada-1.png") {
          await service.updateBrands({
            id: changed.id,
            ...logo("ada-2"),
            logo_width: 120,
            logo_height: 120,
          })
        }
        if (fileId === "bora-1.png") {
          await service.updateBrands({ id: sized.id, logo_width: 300, logo_height: 100 })
        }
        return { width: 600, height: 200 }
      }
      const { page, written } = await fillLogoSizesPage(container, { apply: true }, racing)
      expect(page).toMatchObject({ missing: 3, measured: 3, written: 1, next: null })
      expect(written).toEqual([{ id: kept.id, logo_file_id: "cem-1.png" }])

      const rows = await service.listBrands({}, { order: { handle: "ASC" } })
      expect(rows.map((row) => [row.handle, row.logo_width, row.logo_height])).toEqual([
        ["ada", 120, 120],
        ["bora", 300, 100],
        ["cem", 600, 200],
      ])
    })

    it("goes a page at a time, writes nothing on a dry run, and nothing twice", async () => {
      const made = await service.createBrands(
        Array.from({ length: FILL_PAGE + 1 }, (_, index) => ({
          name: `Marka ${String(index)}`,
          handle: `marka-${String(index)}`,
          ...logo(`marka-${String(index)}`),
        }))
      )
      const ids = made.map((brand) => brand.id).sort()

      const checked = await fillLogoSizesPage(container, { apply: false }, wide)
      expect(checked.page).toMatchObject({
        missing: FILL_PAGE,
        written: 0,
        next: ids[FILL_PAGE - 1],
      })
      const still = await service.listBrands({ logo_width: null })
      expect(still).toHaveLength(FILL_PAGE + 1)

      const first = await fillLogoSizesPage(container, { apply: true }, wide)
      expect(first.page).toMatchObject({ missing: FILL_PAGE, written: FILL_PAGE })
      const second = await fillLogoSizesPage(
        container,
        { apply: true, after: first.page.next },
        wide
      )
      expect(second.page).toMatchObject({ missing: 1, written: 1, next: null })
      expect(await service.listBrands({ logo_width: null })).toHaveLength(0)

      const again = await fillLogoSizesPage(container, { apply: true }, wide)
      expect(again.page).toEqual({
        missing: 0,
        measured: 0,
        unmeasured: [],
        written: 0,
        next: null,
      })
    })
  },
})
