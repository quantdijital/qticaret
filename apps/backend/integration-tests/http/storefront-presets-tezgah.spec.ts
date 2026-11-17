import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack } from "@qticaret/sector-packs"
import { applySectorPack } from "../../src/lib/sector-packs/apply"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Section {
  id: string
  type: string
  [key: string]: unknown
}

interface Applied {
  result: { skipped: { where: string; ref: string }[]; dropped: string[]; kept: string[] }
  layout: { draft: { header: Section[]; home: Section[]; footer: Section[] } }
}

interface StoreLayout {
  layout: {
    home: Section[]
    footer: Section[]
    main: Record<string, Section & { catalog?: Record<string, unknown> }>
    settings: { theme: Record<string, unknown> }
  }
}

const SANTOKU = "/kategori/mutfak-ve-sef-bicaklari/santoku-bicaklari"
const MULTITOOL = "/kategori/outdoor-ve-kamp/multitool"
const BILEME = "/kategori/bakim-ve-aksesuar/bileme-ve-bakim"
const EKMEK = "/kategori/mutfak-ve-sef-bicaklari/ekmek-bicaklari"
const at = (where: string, refs: string[]) => refs.map((ref) => ({ where, ref }))

/**
 * What a new knife shop (the pack's skeleton, no products, no brands) lacks
 * of the preset: the links to the demo's subcategories go alone (adr/0063 §5),
 * the close-up's product drops it.
 */
const SKIPPED = [
  ...at("home.tezgahacilis", [SANTOKU, MULTITOOL, BILEME, BILEME]),
  ...at("home.yakinplan", ["product:karacelik-alageyik-sam-celigi-av-bicagi"]),
  ...at("home.seritgaleri", [SANTOKU, "/marka/karacelik", MULTITOOL]),
  ...at("home.kategoriseridi", [SANTOKU, EKMEK, BILEME]),
  ...at("menus.main", [
    "/kategori/cakilar/kilitli-cakilar",
    "/kategori/cakilar/cok-amacli-cakilar",
    MULTITOOL,
    SANTOKU,
    EKMEK,
    "/kategori/mutfak-ve-sef-bicaklari/soyma-bicaklari",
    BILEME,
    "/kategori/bakim-ve-aksesuar/kiliflar",
  ]),
]

/**
 * The Tezgâh presets (docs/tema/tezgah-tasarim-dili.md) on a new knife shop.
 * Each applies to the draft with only its close-up left out, and the
 * storefront's preview answers the draft the theme draws from.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await settings().saveSection("promotions", { free_shipping_threshold: null }, null)
    })

    it("applies tezgah and its colour siblings to a new knife shop's draft, the preview answering it", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const cutlery = sectorPack("cutlery")
      if (!cutlery) {
        throw new Error("no cutlery pack")
      }
      await applySectorPack(container, cutlery)

      let draft: Section[] = []
      for (const code of ["tezgah-lacivert", "tezgah-turuncu", "tezgah"]) {
        const applied = await settle(
          http.post<Applied>(`/admin/storefront-presets/cutlery/${code}/apply`, {}, asOwner)
        )
        expect(applied.status).toBe(200)
        expect(applied.data.result.dropped).toEqual(["home.yakinplan"])
        expect(applied.data.result.skipped).toEqual(SKIPPED)
        draft = applied.data.layout.draft.home
      }

      // The opening keeps its four slides, no small products (the preset has none)
      expect(draft[0]).toMatchObject({ id: "tezgahacilis", picks: [] })
      expect(draft[0]?.["slides"]).toHaveLength(4)
      expect(draft.map((section) => section.id)).toEqual([
        "tezgahacilis",
        "guvenseridi",
        "yenirafi",
        "kullanimagore",
        "avrafi",
        "kamprafi",
        "sefrafi",
        "fiyatbantlari",
        "indirimdekiler",
        "seritgaleri",
        "kisalisteler",
        "setbandi",
        "coksatanlar",
        "markalar",
        "kategoriseridi",
        "musteriyorumlari",
        "sikcasorulanlar",
      ])

      const preview = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = preview.data.path.split("/").pop() ?? ""
      const previewed = async () => {
        const read = await settle(
          http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
            headers: store.headers,
          })
        )
        expect(read.status).toBe(200)
        return read.data.layout
      }
      const layout = await previewed()
      // The pack's categories are hidden until the shop opens them: the sections they carry wait
      expect(layout.home.map((section) => section.id)).toEqual([
        "tezgahacilis",
        "guvenseridi",
        "yenirafi",
        "fiyatbantlari",
        "indirimdekiler",
        "seritgaleri",
        "setbandi",
        "coksatanlar",
        "markalar",
        "kategoriseridi",
        "musteriyorumlari",
        "sikcasorulanlar",
      ])
      expect(layout.main["header_bar"]).toMatchObject({
        variant: "catalog",
        menu_images: "all",
        search_style: "icon",
        catalog: expect.objectContaining({ menu_ground: "stage", utility_bar: true }) as unknown,
      })
      // No free shipping threshold yet: no half sentence, no note
      expect(layout.main["header_bar"]?.catalog?.["strip_note"]).toBeNull()
      expect(layout.settings.theme).toMatchObject({
        colors: { primary: "#b3261e", accent: "#2e3338", background: "steel" },
        radius: "sharp",
      })

      const saved = await settle(
        http.post("/admin/platform-settings/promotions", { free_shipping_threshold: 1500 }, asOwner)
      )
      expect(saved.status).toBe(200)
      expect((await previewed()).main["header_bar"]?.catalog?.["strip_note"]).toBe(
        "₺1.500 üzeri siparişlerde kargo bedava"
      )
    })
  },
})
