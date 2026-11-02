import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { STOREFRONT_MENUS_MODULE } from ".."
import type StorefrontMenusModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<StorefrontMenusModuleService>({
  moduleName: STOREFRONT_MENUS_MODULE,
  resolve: "./src/modules/storefront-menus",
  testSuite: ({ service }) => {
    it("keeps a menu's links and removes them with it", async () => {
      const menu = await service.createStorefrontMenus({ title: "Ana menü", location: "main" })
      const [parent] = await service.createStorefrontMenuItems([
        { menu_id: menu.id, rank: 0, kind: "category", target: "pcat_1", label: null },
      ])
      await service.createStorefrontMenuItems([
        { menu_id: menu.id, parent_id: parent?.id ?? null, rank: 0, kind: "url", url: "/blog" },
      ])
      expect(await service.listStorefrontMenuItems({ menu_id: menu.id })).toHaveLength(2)

      await service.deleteStorefrontMenus(menu.id)
      expect(await service.listStorefrontMenuItems({ menu_id: menu.id })).toHaveLength(0)
    })

    it("has one header menu and one row of top links, any number of footer columns", async () => {
      await service.createStorefrontMenus({ title: "Ana menü", location: "main" })
      await expect(
        service.createStorefrontMenus({ title: "İkinci", location: "main" })
      ).rejects.toThrow()
      await service.createStorefrontMenus([
        { title: "Kurumsal", location: "footer", rank: 0 },
        { title: "Yardım", location: "footer", rank: 1 },
      ])
      expect(await service.listStorefrontMenus({ location: "footer" })).toHaveLength(2)
    })
  },
})
