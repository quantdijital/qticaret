import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BRANDS_MODULE } from ".."
import type BrandsModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<BrandsModuleService>({
  moduleName: BRANDS_MODULE,
  resolve: "./src/modules/brands",
  testSuite: ({ service }) => {
    it("keeps a logo's width and height beside its file, unknown until set", async () => {
      const bare = await service.createBrands({ name: "Ada", handle: "ada" })
      expect(bare).toMatchObject({ logo_url: null, logo_width: null, logo_height: null })

      const logo = await service.createBrands({
        name: "Bora",
        handle: "bora",
        logo_file_id: "bora-01J.png",
        logo_url: "https://cdn.example.com/bora-01J.png",
        logo_width: 600,
        logo_height: 200,
      })
      const [found] = await service.listBrands({ id: logo.id })
      expect(found).toMatchObject({ logo_width: 600, logo_height: 200 })

      // Taken off with the logo: both back to unknown
      await service.updateBrands({
        id: logo.id,
        logo_file_id: null,
        logo_url: null,
        logo_width: null,
        logo_height: null,
      })
      const [cleared] = await service.listBrands({ id: logo.id })
      expect(cleared).toMatchObject({ logo_url: null, logo_width: null, logo_height: null })

      // A logo with no size is found by the backfill's filter, a sized one is not
      await service.updateBrands({
        id: bare.id,
        logo_file_id: "ada-01J.png",
        logo_url: "https://cdn.example.com/ada-01J.png",
      })
      const missing = await service.listBrands({
        logo_file_id: { $ne: null },
        $or: [{ logo_width: null }, { logo_height: null }],
      })
      expect(missing.map((brand) => brand.id)).toEqual([bare.id])
    })
  },
})
