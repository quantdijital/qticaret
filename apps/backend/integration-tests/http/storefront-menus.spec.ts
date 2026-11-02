import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { moveFrameLinks } from "../../src/migration-scripts/storefront-menus-from-settings"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface AdminLink {
  kind: string
  target: string | null
  label: string | null
  name: string | null
  path: string | null
  broken: boolean
  children: AdminLink[]
}

interface StoreLink {
  label: string | null
  kind: string
  target: string | null
  path: string | null
  children: StoreLink[]
}

interface Menus<T> {
  menus: { id?: string; title: string; location: string; rank: number; items: T[] }[]
}

/** adr/0049: menus whose links point at records, shown as the records are now. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("links records by id: named and placed as they are now, left out while not live", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const post = <T>(url: string, body: unknown) =>
        settle(http.post<T & { message?: string }>(url, body, { headers: owner.headers }))
      const category = (
        await post<{ product_category: { id: string } }>("/admin/product-categories", {
          name: "Çakılar",
          is_active: true,
        })
      ).data.product_category.id
      const draft = (
        await post<{ entry: { id: string } }>("/admin/content", { kind: "page", title: "Taslak" })
      ).data.entry.id

      const main = await post<{ menu: { id: string } }>("/admin/storefront-menus", {
        title: "Ana menü",
        location: "main",
        items: [
          {
            link: { kind: "category", target: category, label: null },
            children: [
              { kind: "system", target: "shop", label: "Tüm ürünler" },
              // The storefront's index pages (docs/20 "sayfalar"): named by the storefront
              { kind: "system", target: "categories", label: null },
              { kind: "system", target: "brands", label: null },
              { kind: "system", target: "sale", label: "Kampanyalar" },
            ],
          },
          { link: { kind: "page", target: draft, label: "Yakında" } },
          { link: { kind: "legal", target: "privacy_notice", label: null } },
          { link: { kind: "url", url: "https://instagram.com/ornek", label: "Instagram" } },
        ],
      })
      const second = await post("/admin/storefront-menus", {
        title: "İkinci",
        location: "main",
        items: [],
      })
      const nested = await post("/admin/storefront-menus", {
        title: "Kurumsal",
        location: "footer",
        items: [
          {
            link: { kind: "system", target: "blog", label: null },
            children: [{ kind: "system", target: "cart", label: null }],
          },
        ],
      })
      const unknown = await post("/admin/storefront-menus", {
        title: "Kurumsal",
        location: "footer",
        items: [{ link: { kind: "product", target: "prod_yok", label: null } }],
      })
      const script = await post("/admin/storefront-menus", {
        title: "Kurumsal",
        location: "footer",
        items: [{ link: { kind: "url", url: "javascript:alert(1)", label: "Tıkla" } }],
      })
      const admin = await settle(
        http.get<Menus<AdminLink>>("/admin/storefront-menus", { headers: owner.headers })
      )
      await post(`/admin/product-categories/${category}`, { name: "El yapımı çakılar" })
      const shown = await settle(
        http.get<Menus<StoreLink>>("/store/storefront-menus", { headers: store.headers })
      )

      expect(main.status).toBe(201)
      expect(second.status).toBe(400)
      expect(second.data.message).toBe("storefront_menus.location_taken")
      expect(nested.status).toBe(400)
      expect(unknown.data.message).toBe("storefront_menus.target_unknown")
      expect(script.status).toBe(400)
      const links = admin.data.menus[0]?.items ?? []
      expect(links.map((link) => [link.kind, link.name, link.broken])).toEqual([
        ["category", "Çakılar", false],
        // A draft page and an unpublished legal text are kept, marked for the panel
        ["page", "Taslak", true],
        ["legal", null, true],
        ["url", null, false],
      ])
      expect(links[0]?.path).toMatch(/^\/.+/)
      const items = shown.data.menus[0]?.items ?? []
      expect(items).toEqual([
        {
          // Renamed after the menu was saved: the menu shows the new name
          label: "El yapımı çakılar",
          kind: "category",
          target: category,
          path: links[0]?.path,
          children: [
            { label: "Tüm ürünler", kind: "system", target: "shop", path: null, children: [] },
            { label: null, kind: "system", target: "categories", path: null, children: [] },
            { label: null, kind: "system", target: "brands", path: null, children: [] },
            { label: "Kampanyalar", kind: "system", target: "sale", path: null, children: [] },
          ],
        },
        {
          label: "Instagram",
          kind: "url",
          target: null,
          path: "https://instagram.com/ornek",
          children: [],
        },
      ])

      // Every page reads every menu: ten footer columns at most
      const columns = await Promise.all(
        Array.from({ length: 10 }, (_, rank) =>
          post("/admin/storefront-menus", {
            title: `Sütun ${String(rank)}`,
            location: "footer",
            rank,
            items: rank === 0 ? [{ link: { kind: "page", target: draft, label: "Taslak" } }] : [],
          })
        )
      )
      const eleventh = await post("/admin/storefront-menus", {
        title: "Fazla",
        location: "footer",
        items: [],
      })
      const withColumns = await settle(
        http.get<Menus<StoreLink>>("/store/storefront-menus", { headers: store.headers })
      )
      expect(columns.map((each) => each.status)).toEqual(Array(10).fill(201))
      expect(eleventh.data.message).toBe("storefront_menus.too_many_footers")
      // A column with no live link (here: a draft page only, or none) is not there
      expect(withColumns.data.menus.map((menu) => menu.location)).toEqual(["main"])

      const removed = await settle(
        http.delete(`/admin/storefront-menus/${main.data.menu.id}`, { headers: owner.headers })
      )
      const after = await settle(
        http.get<Menus<StoreLink>>("/store/storefront-menus", { headers: store.headers })
      )
      expect(removed.status).toBe(200)
      expect(after.data.menus).toEqual([])
    })

    it("turns the frame's typed links into menus once, records where the address is one", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const category = (
        await settle(
          http.post<{ product_category: { id: string; handle: string } }>(
            "/admin/product-categories",
            { name: "Bıçaklar", is_active: true },
            { headers: owner.headers }
          )
        )
      ).data.product_category
      const { data: paths } = await settle(
        http.get<Menus<AdminLink>>("/admin/storefront-menus", { headers: owner.headers })
      )
      expect(paths.menus).toEqual([])
      const resolved = await settle(
        http.get<{ type: string; path?: string; entity?: { path: string } }>(
          `/store/seo/paths?type=product_category&id=${category.id}`,
          { headers: (await createStorefront(container)).headers }
        )
      )
      const categoryPath = (resolved.data as unknown as { paths: Record<string, string> }).paths[
        category.id
      ]
      // As the storefront section held them before menus
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .createSettingsSections({
          section: "storefront",
          values: {
            menu: [{ label: "Bıçaklar", href: `${categoryPath ?? ""}/`, children: [] }],
            top_links: [
              { label: "Hakkımızda", href: "/hakkimizda" },
              { label: "Kampanyalar", href: "/kampanyalar" },
            ],
            footer_groups: [
              { title: "Yardım", links: [{ label: "Sepetim", href: "/sepet" }] },
              { title: "Sosyal", links: [{ label: "X", href: "https://x.com/ornek" }] },
            ],
          },
        })

      const made = await moveFrameLinks(container)
      const again = await moveFrameLinks(container)
      const { data } = await settle(
        http.get<Menus<AdminLink>>("/admin/storefront-menus", { headers: owner.headers })
      )

      expect([made, again]).toEqual([4, 0])
      expect(
        data.menus.map((menu) => [
          menu.location,
          menu.title,
          menu.items.map((link) => [link.kind, link.target, link.label]),
        ])
      ).toEqual([
        ["main", "Ana menü", [["category", category.id, "Bıçaklar"]]],
        // No such page: kept as the address it was
        [
          "top",
          "Üst bağlantılar",
          [
            ["url", null, "Hakkımızda"],
            // The sale page is the storefront's own: a system link
            ["system", "sale", "Kampanyalar"],
          ],
        ],
        ["footer", "Yardım", [["system", "cart", "Sepetim"]]],
        ["footer", "Sosyal", [["url", null, "X"]]],
      ])
    })
  },
})
