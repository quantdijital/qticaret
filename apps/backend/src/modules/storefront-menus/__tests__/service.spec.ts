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

    it("replaces every menu in one transaction: a write failing part-way leaves them as they were", async () => {
      const link = (target: string) => ({ kind: "system" as const, target, url: null, label: null })
      const menu = await service.createStorefrontMenus({ title: "Ana menü", location: "main" })
      await service.createStorefrontMenuItems([
        { menu_id: menu.id, rank: 0, kind: "system", target: "shop", label: null },
      ])
      const one = { title: "Yeni", location: "main" as const, rank: 0 }
      const items = [{ link: link("blog"), children: [link("sale")] }]

      // The second header menu breaks the unique place after the first is written
      await expect(
        service.replaceAllMenus([
          { ...one, items },
          { ...one, title: "İkinci", items: [] },
        ])
      ).rejects.toThrow()
      const kept = await service.listStorefrontMenus({}, { relations: ["items"] })

      await service.replaceAllMenus([
        { ...one, items },
        {
          title: "Kurumsal",
          location: "footer",
          rank: 0,
          items: [{ link: link("cart"), children: [] }],
        },
      ])
      const replaced = await service.listStorefrontMenus({}, { relations: ["items"] })

      expect(kept.map((each) => [each.id, each.title, each.items.length])).toEqual([
        [menu.id, "Ana menü", 1],
      ])
      expect(replaced.map((each) => each.title).sort()).toEqual(["Kurumsal", "Yeni"])
      const made = replaced.find((each) => each.title === "Yeni")
      const parent = made?.items.find((item) => item.parent_id === null)
      expect(made?.items.map((item) => item.target).sort()).toEqual(["blog", "sale"])
      expect(made?.items.find((item) => item.parent_id !== null)?.parent_id).toBe(parent?.id)
    })

    it("puts menus back with their ids, children after their parents", async () => {
      const record = {
        menu: { id: "smenu_01OLD", title: "Eski", location: "main" as const, rank: 0 },
        items: [
          {
            id: "smitem_02CHILD",
            menu_id: "smenu_01OLD",
            parent_id: "smitem_01PARENT",
            rank: 0,
            kind: "system" as const,
            target: "sale",
            url: null,
            label: null,
          },
          {
            id: "smitem_01PARENT",
            menu_id: "smenu_01OLD",
            parent_id: null,
            rank: 0,
            kind: "system" as const,
            target: "shop",
            url: null,
            label: "Mağaza",
          },
        ],
      }
      await service.createStorefrontMenus({ title: "Şimdiki", location: "main" })

      await service.restoreAllMenus([record])
      const back = await service.listStorefrontMenus({}, { relations: ["items"] })

      expect(back.map((each) => [each.id, each.title])).toEqual([["smenu_01OLD", "Eski"]])
      expect(back[0]?.items.map((item) => item.id).sort()).toEqual([
        "smitem_01PARENT",
        "smitem_02CHILD",
      ])
    })
  },
})
