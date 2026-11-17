import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Badge {
  icon: string
  title: string
  text: string | null
}

interface Shared {
  trust_badges: Badge[]
  color_swatches: { label: string; hex: string }[]
  low_stock: { enabled: boolean; threshold: number } | null
  theme?: Record<string, unknown> | null
  menus?: unknown[] | null
  preset?: { pack: string; code: string; version: number } | null
  design?: { id: string | null; digest: string } | null
}

interface AdminLayout {
  layout: {
    draft: Record<string, unknown> & { settings: Shared }
    is_default: boolean
    has_changes: boolean
  }
  message?: string
}

interface StoreLayout {
  layout: { settings: Omit<Shared, "low_stock" | "theme"> & { theme: Record<string, unknown> } }
}

interface Frame {
  storefront: { trust_badges: Badge[]; color_swatches: { label: string; hex: string }[] }
}

interface Facts {
  facts: Record<string, { stock: "in_stock" | "low" | "out" }>
}

const OLD = {
  trust_badges: [{ icon: "truck", title: "{telefon} ile sipariş", text: null }],
  color_swatches: [{ label: "Siyah", hex: "#111111" }],
  low_stock_threshold: 3,
}

const NEW: Shared = {
  trust_badges: [{ icon: "shield", title: "Güvenli ödeme", text: "{mağaza_adı} güvencesi" }],
  color_swatches: [{ label: "Lacivert", hex: "#1F2A44" }],
  low_stock: { enabled: true, threshold: 1 },
}

/**
 * adr/0049 Ek 2026-11-06: the trust badges, the colour names and the "Az
 * kaldı" line are the design's, drafted and published with it; while a
 * part is unset, the storefront settings' old field stands for it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("reads the old fields until the design writes its own, then the published design's", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const shop = await stockShop(container)
      const asOwner = { headers: owner.headers }
      const few = await stockedProduct(container, shop, `az-${String(Date.now())}`, 2)
      const admin = async () =>
        (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))).data.layout
      const live = async () =>
        (
          await settle(
            http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
          )
        ).data.layout
      const frame = async () =>
        (await settle(http.get<Frame>("/store/storefront", { headers: store.headers }))).data
          .storefront
      const stock = async () =>
        (
          await settle(
            http.get<Facts>(`/store/card-facts?id=${few.productId}`, { headers: store.headers })
          )
        ).data.facts[few.productId]?.stock
      const save = (document: Record<string, unknown>) =>
        settle(http.post<AdminLayout>("/admin/storefront-layout", { document }, asOwner))
      const publish = () =>
        settle(http.post<AdminLayout>("/admin/storefront-layout/publish", {}, asOwner))

      await settle(
        http.post("/admin/platform-settings/store", { contact_phone: "0532 123 45 67" }, asOwner)
      )
      await settle(http.post("/admin/platform-settings/storefront", OLD, asOwner))

      // Never written in the design: the editor opens the old fields, the storefront shows them
      const first = await admin()
      const firstLive = await live()
      const firstFrame = await frame()
      const firstStock = await stock()

      const {
        settings: {
          theme: openedTheme,
          menus: openedMenus,
          preset: openedPreset,
          design: openedDesign,
          ...opened
        },
        ...groups
      } = first.draft
      const refused = await save({
        ...groups,
        settings: {
          ...NEW,
          color_swatches: [
            { label: "Işık", hex: "#ffffff" },
            { label: "IŞIK", hex: "#fefefe" },
          ],
        },
      })
      const saved = await save({ ...groups, settings: NEW })
      // Only drafted: nothing changes for shoppers yet
      const draftedFrame = await frame()
      const draftedStock = await stock()
      const published = await publish()
      const publishedLive = await live()
      const publishedFrame = await frame()
      const publishedStock = await stock()

      // A draft without the settings (an older editor): unset again, the old fields stand in
      const older = await save(groups)
      const olderAdmin = await admin()
      await publish()
      const olderLive = await live()
      const olderStock = await stock()

      // Settings outlive the database reset between tests (their cache)
      await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { trust_badges: [], color_swatches: [], low_stock_threshold: 3 },
          asOwner
        )
      )

      expect(first.is_default).toBe(true)
      expect(opened).toEqual({
        trust_badges: OLD.trust_badges,
        color_swatches: OLD.color_swatches,
        low_stock: { enabled: true, threshold: 3 },
      })
      // The theme section stands in for the design's theme (adr/0063 §3); no menu set
      expect(openedTheme).toMatchObject({ settings_version: 2, theme: "atolye", radius: "soft" })
      expect(openedMenus).toBeNull()
      // No ready-made look applied (adr/0063 §2)
      expect(openedPreset).toBeNull()
      // No saved look given either (adr/0064 Ek 2026-11-17)
      expect(openedDesign).toBeNull()
      expect(firstLive.settings.menus).toBeNull()
      expect(firstLive.settings.theme).toMatchObject({ theme: "atolye", radius: "soft" })
      expect(firstLive.settings).toMatchObject({
        trust_badges: [{ icon: "truck", title: "0532 123 45 67 ile sipariş", text: null }],
        color_swatches: OLD.color_swatches,
      })
      expect(firstFrame.trust_badges).toEqual(firstLive.settings.trust_badges)
      expect(firstFrame.color_swatches).toEqual(OLD.color_swatches)
      expect(firstStock).toBe("low")

      expect(refused.status).toBe(400)
      expect(JSON.stringify(refused.data)).toContain("storefront_layout.color_duplicate")
      expect(saved.status).toBe(200)
      expect(saved.data.layout.has_changes).toBe(true)
      // Saved without a theme (an older editor): the theme section stands in again
      expect(saved.data.layout.draft.settings.theme).toEqual(openedTheme)
      expect(saved.data.layout.draft.settings).toMatchObject({
        ...NEW,
        color_swatches: [{ label: "Lacivert", hex: "#1f2a44" }],
      })
      expect(draftedFrame.trust_badges[0]?.icon).toBe("truck")
      expect(draftedStock).toBe("low")

      expect(published.status).toBe(200)
      expect(published.data.layout.has_changes).toBe(false)
      expect(publishedLive.settings.color_swatches).toEqual([{ label: "Lacivert", hex: "#1f2a44" }])
      expect(publishedLive.settings.trust_badges).toHaveLength(1)
      expect(publishedLive.settings.trust_badges[0]).toMatchObject({
        icon: "shield",
        title: "Güvenli ödeme",
      })
      // The shop's details in place, as on every line of the design
      expect(publishedLive.settings.trust_badges[0]?.text).not.toContain("{")
      expect(publishedFrame.trust_badges).toEqual(publishedLive.settings.trust_badges)
      expect(publishedFrame.color_swatches).toEqual(publishedLive.settings.color_swatches)
      // Two in stock, "Az kaldı" at one or fewer
      expect(publishedStock).toBe("in_stock")

      expect(older.status).toBe(200)
      expect(olderAdmin.draft.settings.low_stock).toEqual({ enabled: true, threshold: 3 })
      expect(olderAdmin.has_changes).toBe(true)
      expect(olderLive.settings.color_swatches).toEqual(OLD.color_swatches)
      expect(olderStock).toBe("low")
    })
  },
})
