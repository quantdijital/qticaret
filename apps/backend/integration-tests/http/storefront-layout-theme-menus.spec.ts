import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { MenuSet } from "../../src/lib/storefront/layout-menus"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { replaceMenusStep } from "../../src/workflows/storefront/menus-replace"
import { storeMenus } from "../../src/workflows/storefront/menus-read"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Theme {
  theme: string
  colors: { primary: string | null; accent: string | null; background: string }
  typography: { heading: string; body: string }
  radius: string
  product_card: { ratio: string; show_brand: boolean; show_rating: boolean }
  header: { layout: string; sticky: boolean }
  buttons: string
}

type StoredTheme = Theme & { settings_version: number }

interface StoreMenu {
  title: string
  location: string
  items: { label: string | null; kind: string; target: string | null; path: string | null }[]
}

interface AdminLayout {
  layout: {
    draft: Record<string, unknown> & {
      settings: Record<string, unknown> & { theme: StoredTheme; menus: unknown[] | null }
    }
    has_changes: boolean
    revisions: { revision: number; has_menus: boolean }[]
  }
  message?: string
}

interface StoreLayout {
  layout: { settings: { theme: Theme; menus: StoreMenu[] | null } }
}

const link = (target: string, label: string | null = null) => ({
  link: { kind: "system", target, label },
})

const SET = [
  { title: "Görünüm menüsü", location: "main", items: [link("shop", "Bütün ürünler")] },
  { title: "Kurumsal", location: "footer", items: [link("blog")] },
]

// The part of the theme the storefront sees: the section's version stays inside
const shown = (theme: StoredTheme): Theme => {
  const { settings_version: version, ...rest } = theme
  expect(version).toBe(2)
  return rest
}

/**
 * adr/0063 §3: the theme's settings and a menu set are part of the design,
 * drafted, previewed and published with it; the live menus stay the
 * Menüler screen's, a published set replacing them once.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("drafts, previews and publishes the theme and a menu set, then goes back without the menus", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const admin = async () =>
        (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))).data.layout
      const save = (document: Record<string, unknown>) =>
        settle(http.post<AdminLayout>("/admin/storefront-layout", { document }, asOwner))
      const action = (path: string, body: object = {}) =>
        settle(http.post<AdminLayout>(`/admin/storefront-layout/${path}`, body, asOwner))
      const frameTheme = async () =>
        (await settle(http.get<{ theme: Theme }>("/store/storefront", { headers: store.headers })))
          .data.theme
      const liveMenus = async () =>
        (
          await settle(
            http.get<{ menus: StoreMenu[] }>("/store/storefront-menus", { headers: store.headers })
          )
        ).data.menus
      const preview = async () => {
        const made = await settle(
          http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
        )
        const token = made.data.path.split("/").pop() ?? ""
        return (
          await settle(
            http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
              headers: store.headers,
            })
          )
        ).data.layout.settings
      }

      // The shop's own menu, made on the Menüler screen; and its old main colour
      await settle(
        http.post(
          "/admin/storefront-menus",
          { title: "Mağaza menüsü", location: "main", items: [link("home", "Anasayfa")] },
          asOwner
        )
      )
      await settle(
        http.post("/admin/platform-settings/storefront", { primary_color: "#0b5c99" }, asOwner)
      )

      // Never written in the design: the editor opens the theme section, the old colour in
      const first = await admin()
      const opened = first.draft.settings.theme
      const before = await frameTheme()
      const { settings, ...groups } = first.draft
      const theme = { ...opened, radius: "round", buttons: "square" }

      const pale = await save({
        ...groups,
        settings: {
          ...settings,
          theme: { ...theme, colors: { ...theme.colors, primary: "#fde68a" } },
        },
      })
      // #919191 reads on the steel page (3.01:1), not in its well: refused as a change
      const inWell = await save({
        ...groups,
        settings: {
          ...settings,
          theme: { ...theme, colors: { ...theme.colors, primary: "#919191" } },
        },
      })
      const unknownTarget = await save({
        ...groups,
        settings: {
          ...settings,
          menus: [
            {
              title: "Yok",
              location: "top",
              items: [{ link: { kind: "category", target: "pcat_01YOK", label: null } }],
            },
          ],
        },
      })
      const twoMains = await save({ ...groups, settings: { ...settings, menus: [SET[0], SET[0]] } })
      const saved = await save({ ...groups, settings: { ...settings, theme, menus: SET } })

      // Drafted only: shoppers see the old theme and the shop's menu; the preview shows both
      const draftedTheme = await frameTheme()
      const draftedMenus = await liveMenus()
      const previewed = await preview()

      const published = await action("publish")
      const afterAdmin = await admin()
      const publishedTheme = await frameTheme()
      const publishedMenus = await liveMenus()

      // The Menüler screen again: a later publication leaves its change alone
      await settle(
        http.post(
          "/admin/storefront-menus",
          { title: "Üst satır", location: "top", items: [link("cart")] },
          asOwner
        )
      )
      const again = await action("publish")
      const keptMenus = await liveMenus()

      const withoutMenus = await action("revisions/2/restore", { menus: false })
      const withMenus = await action("revisions/2/restore")
      const strangeBody = await action("revisions/2/restore", { menus: "evet" })

      // Settings outlive the database reset between tests (their cache)
      await settle(
        http.post("/admin/platform-settings/storefront", { primary_color: null }, asOwner)
      )

      expect(opened).toMatchObject({ settings_version: 2, theme: "atolye", radius: "soft" })
      expect(opened.colors.primary).toBe("#0b5c99")
      expect(first.draft.settings.menus).toBeNull()
      expect(before).toEqual(shown(opened))

      expect(pale.status).toBe(400)
      expect(JSON.stringify(pale.data)).toContain("platform_settings.color_contrast")
      expect(inWell.status).toBe(400)
      expect(inWell.data.message).toBe("platform_settings.color_contrast")
      expect(unknownTarget.status).toBe(400)
      expect(unknownTarget.data.message).toBe("storefront_menus.target_unknown")
      expect(twoMains.status).toBe(400)
      expect(JSON.stringify(twoMains.data)).toContain("storefront_menus.location_taken")
      expect(saved.status).toBe(200)
      expect(saved.data.layout.has_changes).toBe(true)
      expect(saved.data.layout.draft.settings.theme).toEqual(theme)

      expect(draftedTheme).toEqual(before)
      expect(draftedMenus.map((menu) => menu.title)).toEqual(["Mağaza menüsü"])
      expect(previewed.theme).toEqual(shown(theme as StoredTheme))
      expect(previewed.menus).toEqual([
        {
          title: "Görünüm menüsü",
          location: "main",
          rank: 0,
          items: [
            { label: "Bütün ürünler", kind: "system", target: "shop", path: null, children: [] },
          ],
        },
        {
          title: "Kurumsal",
          location: "footer",
          rank: 0,
          items: [{ label: null, kind: "system", target: "blog", path: null, children: [] }],
        },
      ])

      expect(published.status).toBe(200)
      expect(publishedTheme).toEqual(shown(theme as StoredTheme))
      expect(publishedMenus.map((menu) => menu.title)).toEqual(["Görünüm menüsü", "Kurumsal"])
      // Live now: the draft's set is cleared, nothing waits
      expect(afterAdmin.draft.settings.menus).toBeNull()
      expect(afterAdmin.has_changes).toBe(false)
      expect(afterAdmin.revisions).toEqual([
        expect.objectContaining({ revision: 1, has_menus: true }),
      ])

      expect(again.status).toBe(200)
      expect(keptMenus.map((menu) => menu.title)).toEqual([
        "Görünüm menüsü",
        "Üst satır",
        "Kurumsal",
      ])
      expect(again.data.layout.revisions.map((each) => [each.revision, each.has_menus])).toEqual([
        [2, false],
        [1, true],
      ])

      // Revision 2 holds no set; revision 1 does
      expect(withoutMenus.data.layout.draft.settings.menus).toBeNull()
      expect(withMenus.data.layout.draft.settings.menus).toBeNull()
      const first1 = await action("revisions/1/restore", { menus: false })
      const first1Menus = await action("revisions/1/restore")
      expect(first1.data.layout.draft.settings.menus).toBeNull()
      expect(first1Menus.data.layout.draft.settings.menus).toHaveLength(2)
      expect(first1Menus.data.layout.draft.settings.theme).toEqual(theme)
      expect(strangeBody.status).toBe(400)
    })

    it("puts the shop's menus back as they were when a publication fails after the set went live", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      await settle(
        http.post(
          "/admin/storefront-menus",
          {
            title: "Mağaza menüsü",
            location: "main",
            items: [
              { ...link("shop"), children: [{ kind: "system", target: "sale", label: "İndirim" }] },
            ],
          },
          { headers: owner.headers }
        )
      )
      const failAfter = createStep("test-fail-after-menus", () => {
        throw new Error("after the menus")
      })
      const replaceThenFail = createWorkflow("test-replace-menus-then-fail", (set: MenuSet) => {
        replaceMenusStep(set)
        failAfter()
        return new WorkflowResponse(undefined)
      })
      const noop = createStep("test-noop", () => new StepResponse(undefined))
      const replaceOnly = createWorkflow("test-replace-menus", (set: MenuSet | null) => {
        replaceMenusStep(set)
        noop()
        return new WorkflowResponse(undefined)
      })
      const set: MenuSet = [
        {
          title: "Görünüm",
          location: "main",
          rank: 0,
          items: [{ link: { kind: "system", target: "blog", label: null }, children: [] }],
        },
      ]

      const before = await storeMenus(container)
      const { errors } = await replaceThenFail(container).run({ input: set, throwOnError: false })
      const after = await storeMenus(container)
      await replaceOnly(container).run({ input: null })
      const untouched = await storeMenus(container)

      expect(errors).toHaveLength(1)
      expect(after).toEqual(before)
      expect(after[0]?.items[0]?.children.map((child) => child.label)).toEqual(["İndirim"])
      expect(untouched).toEqual(before)
    })

    it("reads the theme section until the design has a theme of its own", async () => {
      const container = getContainer()
      const store = await createStorefront(container)
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection("theme", { radius: "sharp" }, null)
      const frame = await settle(
        http.get<{ theme: Theme }>("/store/storefront", { headers: store.headers })
      )
      const layout = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      await settings.saveSection("theme", { radius: "soft" }, null)

      expect(frame.data.theme.radius).toBe("sharp")
      expect(layout.data.layout.settings.theme).toEqual(frame.data.theme)
      // The live menus are the module's: the published design never prints a set
      expect(layout.data.layout.settings.menus).toBeNull()
    })
  },
})
