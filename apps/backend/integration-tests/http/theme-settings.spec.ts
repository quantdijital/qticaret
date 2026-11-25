import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Frame {
  storefront: { primary_color: string | null }
  theme: {
    theme: string
    colors: { primary: string | null; accent: string | null; background: string }
    typography: { heading: string; body: string }
    radius: string
    product_card: Record<string, unknown>
    header: { layout: string; sticky: boolean }
    buttons: string
    section_spacing: string
    surface_style: string
    menu_style: string
    shadow: string
    chip_style: string
    media_ground: string
    density: string
    motion: string
    listing_text: { size: string; align: string; width: string; collapse: boolean }
    search_form: Record<string, unknown>
  }
}

/** The style kit at today's drawing (adr/0067 §1, S6 its Ek 2026-11-16). */
const KIT = {
  menu_style: "filled",
  shadow: "float",
  chip_style: "filled",
  media_ground: "well",
  density: "airy",
  motion: "calm",
}

/** A listing page's own text at its foot, at its defaults (adr/0075). */
const LISTING_TEXT = { size: "md", align: "start", width: "narrow", collapse: true }

/** The search box's fields at their defaults (adr/0077 §1). */
const SEARCH_FORM = {
  attribute_key: null,
  show_category: true,
  show_dates: true,
  show_people: true,
  flexible_month: true,
  date_words: false,
  boxed_fields: false,
  category_style: "select",
  placeholder: null,
}

/** The card's variant and the framed card's switches at their defaults (adr/0049 Ek 2026-11-14 §3.3). */
const CARD = {
  variant: "standard",
  hover_image: true,
  delivery_note: true,
  full_button: true,
  // adr/0049 Ek 2026-11-15: every pill, the price on a sold-out card, no stars without reviews
  sale_badge: true,
  low_stock_badge: true,
  sold_out_badge: true,
  sold_out_row: "price",
  no_reviews: "hide",
  button_style: "outline",
  // adr/0049 Ek 2026-11-15: no quick view until the shop turns it on
  quick_view: false,
  quick_view_trigger: "hover",
  quick_view_rating: true,
  quick_view_summary: true,
  quick_view_quantity: true,
  // adr/0077 Ek "tur kartı": words under the photo, none of the tour card's extras
  text_position: "below",
  rating_badge: false,
  arrow: false,
  duration_row: false,
  per_person: false,
}

/** F18 D11 (adr/0053): the shop picks its look from fixed lists; the storefront reads it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves the theme, serves it to the storefront and refuses an unreadable main colour", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const ops = await createAdminUser(http, container, "operations")
      const store = await createStorefront(container)
      const frame = () => settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      const save = (headers: Record<string, string>, body: unknown) =>
        settle(http.post("/admin/platform-settings/theme", body, { headers }))

      const before = await frame()
      // The storefront section's colour stands in until the theme has its own
      await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { primary_color: "#0B5C99" },
          { headers: owner.headers }
        )
      )
      const fallback = await frame()
      const pale = await save(admin.headers, { colors: { primary: "#fde68a" } })
      const fontAddress = await save(admin.headers, {
        typography: { heading: "https://fonts.example/x.woff2" },
      })
      const css = await save(admin.headers, { css: "body{display:none}" })
      const byOps = await save(ops.headers, { radius: "round" })
      const offKit = await save(admin.headers, { menu_style: "boxed" })
      const saved = await save(admin.headers, {
        colors: { primary: "#1E3A8A", background: "cool" },
        typography: { heading: "playfair" },
        product_card: { show_rating: true },
        header: { layout: "centered" },
        buttons: "rounded",
        section_spacing: "roomy",
        surface_style: "lined",
        menu_style: "plain",
        shadow: "none",
        // adr/0075: one field of the group; the others keep theirs
        listing_text: { size: "lg" },
      })
      const after = await frame()

      expect(before.status).toBe(200)
      // Today's Grafit look (adr/0062 §2); the section's own version stays inside
      expect(before.data.theme).toEqual({
        theme: "atolye",
        colors: { primary: null, accent: null, background: "steel" },
        typography: { heading: "manrope", body: "manrope" },
        radius: "soft",
        product_card: { ...CARD, ratio: "1:1", show_brand: true, show_rating: false },
        header: { layout: "left", sticky: true },
        buttons: "pill",
        section_spacing: "normal",
        // A row before the surface style reads today's filled boxes (Z-04)
        surface_style: "filled",
        // and before the style kit, today's drawing (adr/0067)
        ...KIT,
        // and before the listing text, its defaults (adr/0075)
        listing_text: LISTING_TEXT,
        search_form: SEARCH_FORM,
      })
      expect(fallback.data.theme.colors.primary).toBe("#0b5c99")
      expect(pale.status).toBe(400)
      expect(pale.data).toMatchObject({ message: "platform_settings.color_contrast" })
      expect([fontAddress.status, css.status]).toEqual([400, 400])
      expect(byOps.status).toBe(403)
      expect(offKit.status).toBe(400)
      expect(saved.status).toBe(200)
      expect(after.data.theme).toEqual({
        theme: "atolye",
        colors: { primary: "#1e3a8a", accent: null, background: "cool" },
        typography: { heading: "playfair", body: "manrope" },
        radius: "soft",
        product_card: { ...CARD, ratio: "1:1", show_brand: true, show_rating: true },
        header: { layout: "centered", sticky: true },
        buttons: "rounded",
        section_spacing: "roomy",
        surface_style: "lined",
        ...KIT,
        menu_style: "plain",
        shadow: "none",
        listing_text: { ...LISTING_TEXT, size: "lg" },
        search_form: SEARCH_FORM,
      })
      // The old field stays until the storefront and the panel move over
      expect(after.data.storefront.primary_color).toBe("#0b5c99")
    })

    it("reads a row stored before adr/0062 as the storefront drew it, and stores it with the version at the next save", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      const section = () =>
        settle(
          http.get<{ values: Record<string, unknown> }>("/admin/platform-settings/theme", {
            headers: owner.headers,
          })
        )
      // As `saveSection` wrote it then: the shop's colour, and choices Atölye never showed
      await settings.createSettingsSections({
        section: "theme",
        values: {
          theme: "atolye",
          colors: { primary: "#7a1a48", accent: "#f5d90a", background: "warm" },
          typography: { heading: "playfair", body: "inter" },
          radius: "round",
          product_card: { ratio: "4:5", show_brand: false, show_rating: true },
          header: { layout: "centered", sticky: false },
          buttons: "square",
        },
      })
      const grafit = {
        theme: "atolye",
        colors: { primary: "#7a1a48", accent: null, background: "steel" },
        typography: { heading: "manrope", body: "manrope" },
        radius: "soft",
        product_card: { ...CARD, ratio: "1:1", show_brand: false, show_rating: false },
        header: { layout: "left", sticky: false },
        buttons: "pill",
        section_spacing: "normal",
        surface_style: "filled",
        ...KIT,
        listing_text: LISTING_TEXT,
        search_form: SEARCH_FORM,
      }

      const read = await section()
      const saved = await settle(
        http.post(
          "/admin/platform-settings/theme",
          { typography: { heading: "fraunces" } },
          { headers: owner.headers }
        )
      )
      const [row] = await settings.listSettingsSections({ section: "theme" })
      const shown = await settle(http.get<Frame>("/store/storefront", { headers: store.headers }))
      // A choice made since is the shop's own, the old default's value included
      const chosen = { ...grafit, typography: { heading: "fraunces", body: "manrope" } }

      expect(read.data.values).toEqual({ settings_version: 2, ...grafit })
      expect(saved.status).toBe(200)
      expect(row?.values).toEqual({ settings_version: 2, ...chosen })
      expect((await section()).data.values).toEqual({ settings_version: 2, ...chosen })
      expect(shown.data.theme).toEqual(chosen)
    })
  },
})
