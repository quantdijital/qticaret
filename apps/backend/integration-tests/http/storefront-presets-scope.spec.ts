import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { storefrontPreset } from "@qticaret/sector-packs"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface Draft {
  home: { id: string; type: string }[]
  settings: Record<string, unknown> & {
    preset: unknown
    theme: { colors?: { primary?: string | null } } | null
  }
}

interface Applied {
  result: {
    pack: string
    preset: string
    scope?: string
    skipped: { where: string; ref: string }[]
    dropped: string[]
    auto_saved: unknown
  }
  layout: { draft: Draft }
}

interface Unfit {
  unfit: { where: string; type: string; refs: string[]; reason: string }[]
}

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }
const OTHER = { pack: "cutlery", code: "tezgah" } as const

/**
 * The owner's decision of 2026-11-28: another sector's ready-made look in a
 * shop never given its pack. Its style alone keeps the shop's sections;
 * whole, its sections bound to records the shop lacks are left out, and the
 * apply window can list them before anything is written.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("takes another sector's style alone, or its sections where the shop has their records", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      const tezgah = storefrontPreset(OTHER.pack, OTHER.code)
      if (!tezgah) {
        throw new Error("no tezgah preset")
      }
      const path = `/admin/storefront-presets/${OTHER.pack}/${OTHER.code}`
      const admin = async () =>
        (await settle(http.get<{ layout: { draft: Draft } }>("/admin/storefront-layout", asOwner)))
          .data.layout.draft

      // The shop's own home page of one section, saved as its draft
      const opened = await admin()
      const own = {
        ...opened,
        home: [{ id: "yardimkutusu", type: "help", ...SCHEDULE, title: "Bize yazın", text: null }],
      }
      expect(
        (await settle(http.post("/admin/storefront-layout", { document: own }, asOwner))).status
      ).toBe(200)
      const before = (await layoutRow(container))?.draft as Draft

      // A scope no one writes is refused
      expect(
        (await settle(http.post(`${path}/apply`, { scope: "sections" }, asOwner))).status
      ).toBe(400)

      // The fit, read before: its category rails and its close-up product are not in this shop
      const fit = await settle(http.get<Unfit>(`${path}/fit`, asOwner))
      expect(fit.status).toBe(200)
      const where = fit.data.unfit.map((each) => each.where)
      expect(where).toEqual(expect.arrayContaining(["home.kullanimagore", "home.yakinplan"]))
      expect(where.every((each) => !each.startsWith("header."))).toBe(true)
      expect(fit.data.unfit.find((each) => each.where === "home.yakinplan")).toMatchObject({
        type: "featured_product",
        reason: "missing",
        refs: [expect.stringMatching(/^product:/) as unknown],
      })
      expect(
        (await settle(http.get(`/admin/storefront-presets/yok/yok/fit`, asOwner))).status
      ).toBe(404)

      // Its style alone: the theme is the look's, the sections and the label the draft's own
      const style = await settle(http.post<Applied>(`${path}/apply`, { scope: "style" }, asOwner))
      expect(style.status).toBe(200)
      expect(style.data.result).toMatchObject({
        pack: OTHER.pack,
        preset: OTHER.code,
        scope: "style",
        skipped: [],
        dropped: [],
      })
      const styled = await admin()
      expect(styled.home.map((each) => each.id)).toEqual(["yardimkutusu"])
      expect(styled.settings.theme?.colors?.primary).toBe(
        (tezgah.theme_settings as { colors: { primary: string } }).colors.primary
      )
      expect(styled.settings.preset ?? null).toEqual(before.settings.preset ?? null)

      // Whole: what the shop has no record for is left out and named, nothing stood in for
      const full = await settle(http.post<Applied>(`${path}/apply`, {}, asOwner))
      expect(full.status).toBe(200)
      expect(full.data.result.dropped).toEqual(
        expect.arrayContaining(["home.kullanimagore", "home.yakinplan"])
      )
      const whole = await admin()
      expect(whole.home.map((each) => each.id)).not.toContain("kullanimagore")
      expect(whole.settings.preset).toMatchObject(OTHER)

      // Nothing went live
      expect((await layoutRow(container))?.published ?? null).toBeNull()
    })
  },
})
