import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
type Groups = Record<"header" | "home" | "footer" | "product" | "category", Section[]>

interface AdminLayout {
  layout: { draft: Groups; has_changes: boolean }
  message?: string
}

interface StoreLayout {
  layout: Groups & { main: Record<string, Section> }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const bar = { id: "duyuru0001", type: "announcement_bar", ...ALWAYS, lines: ["Kargo bedava"] }

/** adr/0049 Ek 2026-11-14 §5, §7: the main sections, read into a design without them. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("reads the main sections in, saves the header bar's own, and gives them to the storefront apart", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const admin = async () =>
        (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))).data.layout
      const live = async () =>
        (
          await settle(
            http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
          )
        ).data.layout
      const save = (document: Partial<Groups>) =>
        settle(
          http.post<AdminLayout>(
            "/admin/storefront-layout",
            { document: { header: [], home: [], footer: [], ...document } },
            asOwner
          )
        )

      // The default design: each main section read in, the header bar from the theme's header
      const opened = await admin()
      expect(opened.has_changes).toBe(false)
      expect(opened.draft.header.at(-1)).toEqual({
        id: "mainheader",
        type: "header_bar",
        variant: "standard",
        sticky: true,
        menu_images: "submenus",
        search_style: "field",
        ...ALWAYS,
      })
      expect(opened.draft.footer[0]).toMatchObject({ type: "footer_bar", variant: "ledger" })
      expect(opened.draft.product[0]).toMatchObject({ type: "product_main", variant: "standard" })
      expect(opened.draft.category[0]).toMatchObject({ type: "category_main", by_variant: {} })

      const before = await live()
      expect(before.header.some((section) => section.type === "header_bar")).toBe(false)
      expect(before.main).toEqual({
        header_bar: {
          id: "mainheader",
          type: "header_bar",
          variant: "standard",
          sticky: true,
          menu_images: "submenus",
          search_style: "field",
        },
        footer_bar: { id: "mainfooter", type: "footer_bar", variant: "ledger" },
        product_main: { id: "mainproduct", type: "product_main", variant: "standard" },
        category_main: {
          id: "maincategory",
          type: "category_main",
          variant: "standard",
          by_variant: {},
        },
      })

      // A main section cannot be hidden, nor take a variant off its list
      const hidden = await save({
        header: [{ id: "mainheader", type: "header_bar", visible: false }],
      })
      expect(hidden.status).toBe(400)
      expect(hidden.data.message).toContain("storefront_layout.section_invalid")
      expect(
        (await save({ footer: [{ id: "mainfooter", type: "footer_bar", variant: "dark_rich" }] }))
          .status
      ).toBe(400)

      // The first save writes the bar's values; what is live follows on publishing
      const saved = await save({
        // The menus' pictures in "Kategoriler" too (adr/0049 Ek 2026-11-15)
        header: [
          bar,
          {
            id: "mainheader",
            type: "header_bar",
            variant: "centered",
            sticky: false,
            menu_images: "all",
            search_style: "icon",
          },
        ],
        product: [
          { id: "mainproduct", type: "product_main", look: { width: "narrow" } },
          { id: "yardim0001", type: "help" },
        ],
      })
      expect(saved.status).toBe(200)
      expect((await admin()).draft.header).toEqual([
        {
          ...bar,
          mode: "first",
          interval: "medium",
          pause_button: "always",
          hover_pause: "on",
          align: "auto",
          size: "medium",
        },
        {
          id: "mainheader",
          type: "header_bar",
          variant: "centered",
          sticky: false,
          menu_images: "all",
          search_style: "icon",
          ...ALWAYS,
        },
      ])
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const after = await live()
      expect(after.header.map((section) => section.type)).toEqual(["announcement_bar"])
      expect(after.main["header_bar"]).toEqual({
        id: "mainheader",
        type: "header_bar",
        variant: "centered",
        sticky: false,
        menu_images: "all",
        search_style: "icon",
      })
      expect(after.product.map((section) => section.type)).toEqual(["help"])
      expect(after.main["product_main"]).toMatchObject({ look: { width: "narrow" } })
      expect(after.footer).toEqual([])
      expect((await admin()).has_changes).toBe(false)
    })
  },
})
