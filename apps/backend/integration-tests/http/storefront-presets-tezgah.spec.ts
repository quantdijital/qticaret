import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack } from "@qticaret/sector-packs"
import { applySectorPack } from "../../src/lib/sector-packs/apply"
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
    main: Record<string, Section>
    settings: { theme: Record<string, unknown> }
  }
}

/**
 * The Tezgâh presets (docs/tema/tezgah-tasarim-dili.md) on a new knife shop:
 * the cutlery pack's skeleton and no products. Each applies to the draft
 * with only its close-up (a product of the shop's) left out, and the
 * storefront's preview answers the draft the theme draws from.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

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
        expect(applied.data.result.skipped).toEqual([
          { where: "home.yakinplan", ref: "product:karacelik-alageyik-sam-celigi-av-bicagi" },
        ])
        draft = applied.data.layout.draft.home
      }

      const preview = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = preview.data.path.split("/").pop() ?? ""
      const previewed = await settle(
        http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
          headers: store.headers,
        })
      )
      expect(previewed.status).toBe(200)
      // The draft keeps every section but the close-up; the pack's categories are hidden
      // until the shop opens them, so the store leaves out the sections they carry
      expect(draft.map((section) => section.id)).toEqual([
        "tezgahacilis",
        "guvenseridi",
        "yenirafi",
        "avrafi",
        "kamprafi",
        "sefrafi",
        "fiyatbantlari",
        "coksatanlar",
        "kullanimagore",
        "indirimdekiler",
        "yazilar",
        "markalar",
        "kisalisteler",
        "musteriyorumlari",
      ])
      expect(previewed.data.layout.home.map((section) => section.id)).toEqual([
        "tezgahacilis",
        "guvenseridi",
        "yenirafi",
        "fiyatbantlari",
        "coksatanlar",
        "indirimdekiler",
        "yazilar",
        "markalar",
        "musteriyorumlari",
      ])
      expect(previewed.data.layout.main["header_bar"]).toMatchObject({
        variant: "catalog",
        // Pictures in "Kategoriler" too (adr/0049 Ek 2026-11-15)
        menu_images: "all",
        catalog: expect.objectContaining({ menu_ground: "stage", utility_bar: true }) as unknown,
      })
      expect(previewed.data.layout.settings.theme).toMatchObject({
        colors: { primary: "#b3261e", accent: "#2e3338", background: "steel" },
        radius: "sharp",
      })
    })
  },
})
