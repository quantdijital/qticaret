import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DEFAULT_PACKS_DIR } from "@qticaret/sector-packs"
import sharp from "sharp"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { applyPresetWorkflow } from "../../src/workflows/storefront/preset-apply"
import applyPreset from "../../src/scripts/apply-preset"
import { readTenantResult } from "@qticaret/types/control-plane"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

type Doc = Record<string, unknown> & {
  home: { id: string; type: string; category_ids?: string[]; image?: { url: string } | null }[]
  settings: Record<string, unknown> & { preset: unknown; trust_badges: unknown }
}

interface AdminLayout {
  layout: { draft: Doc; has_changes: boolean }
}

interface Applied {
  result: {
    pack: string
    preset: string
    version: number
    skipped: { where: string; ref: string }[]
    dropped: string[]
    images: { added: number; kept: number }
  }
  layout: AdminLayout["layout"]
  message?: string
}

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }

/** A `general` pack beside the repository's, with one preset that has an image and handles. */
async function fixturePacks(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "presets-"))
  const preset = join(root, "general", "presets", "vitrin")
  mkdirSync(join(preset, "images"), { recursive: true })
  copyFileSync(
    join(DEFAULT_PACKS_DIR, "general", "manifest.json"),
    join(root, "general", "manifest.json")
  )
  copyFileSync(
    join(DEFAULT_PACKS_DIR, "general", "presets", "grafit", "theme.json"),
    join(preset, "theme.json")
  )
  const png = await sharp({
    create: { width: 96, height: 64, channels: 3, background: { r: 40, g: 44, b: 52 } },
  })
    .png()
    .toBuffer()
  writeFileSync(join(preset, "images", "hero.png"), png)
  const json = (name: string, value: unknown) => {
    writeFileSync(join(preset, name), JSON.stringify(value))
  }
  json("preset.json", {
    format: "quant-storefront-preset",
    code: "vitrin",
    version: 1,
    theme: "atolye",
    name: "Vitrin",
    description: "Deneme görünümü.",
    tone: "dark",
    credits: [{ file: "images/hero.png", source: "test", license: "test" }],
  })
  json("layout.json", {
    home: [
      {
        id: "girisbolumu",
        type: "hero",
        ...SCHEDULE,
        links: [{ $href: "/cakilar", label: "Çakılar" }],
        image: { $image: "images/hero.png", alt: "Atölye" },
      },
      {
        id: "kategoriler",
        type: "categories",
        ...SCHEDULE,
        category_ids: [{ $handle: "category:cakilar" }, { $handle: "category:kiliclar" }],
      },
      {
        id: "onecikan",
        type: "featured_product",
        ...SCHEDULE,
        product_id: { $handle: "product:yok" },
      },
    ],
  })
  return root
}

/**
 * adr/0063 §4, §7: a preset applied writes the draft only, the same draft
 * each time; its images are uploaded once; what the shop lacks is left out.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let packs: string

    beforeAll(async () => {
      packs = await fixturePacks()
    })
    afterAll(() => {
      rmSync(packs, { recursive: true, force: true })
    })

    it("applies grafit to the draft twice alike, leaving the live design alone", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      const admin = async () =>
        (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))).data.layout
      const apply = (pack: string, code: string, body: object = {}) =>
        settle(http.post<Applied>(`/admin/storefront-presets/${pack}/${code}/apply`, body, asOwner))

      const gallery = await settle(
        http.get<{ presets: { pack: string; code: string; in_draft: number | null }[] }>(
          "/admin/storefront-presets",
          asOwner
        )
      )
      expect(gallery.data.presets).toEqual(
        expect.arrayContaining([expect.objectContaining({ pack: "general", code: "grafit" })])
      )

      // The shop's own design, live, with its own trust badges and a home page of one section
      const opened = await admin()
      const badges = [{ icon: "truck", title: "Aynı gün kargo", text: null }]
      const own = {
        ...opened.draft,
        home: [{ id: "yardimkutusu", type: "help", ...SCHEDULE, title: "Bize yazın", text: null }],
        settings: { ...opened.draft.settings, trust_badges: badges },
      }
      expect(
        (await settle(http.post("/admin/storefront-layout", { document: own }, asOwner))).status
      ).toBe(200)
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const live = (await layoutRow(container))?.published

      const first = await apply("general", "grafit")
      expect(first.status).toBe(200)
      expect(first.data.result).toEqual({
        pack: "general",
        preset: "grafit",
        version: 1,
        skipped: [],
        dropped: [],
        images: { added: 0, kept: 0 },
        demo: { added: 0, kept: 0 },
      })
      const draft = first.data.layout.draft
      expect(draft.home.map((section) => section.id)).toEqual([
        "girisbolumu",
        "kategoriler",
        "yeniurunler",
        "yardimkutusu",
        "blogyazilari",
      ])
      expect(draft.settings.preset).toEqual({ pack: "general", code: "grafit", version: 1 })
      // The shop's badges stay; the theme is grafit's, written into the design
      expect(draft.settings.trust_badges).toEqual(badges)
      expect(draft.settings["theme"]).toEqual(
        expect.objectContaining({ theme: "atolye", radius: "soft", buttons: "pill" })
      )
      expect(first.data.layout.has_changes).toBe(true)
      expect((await layoutRow(container))?.published).toEqual(live)

      const second = await apply("general", "grafit")
      expect(second.status).toBe(200)
      expect(second.data.layout.draft).toEqual(draft)
      expect((await layoutRow(container))?.published).toEqual(live)

      // Unknown, refused demo, and not for operations
      expect((await apply("general", "yok")).status).toBe(404)
      expect((await apply("general", "grafit", { demo: true })).status).toBe(400)
      expect((await apply("general", "grafit", { other: 1 })).status).toBe(400)
      const operations = await createAdminUser(http, container, "operations")
      const refused = await settle(
        http.post(
          "/admin/storefront-presets/general/grafit/apply",
          {},
          { headers: operations.headers }
        )
      )
      expect(refused.status).toBe(403)
    })

    it("uploads a preset's image once and leaves out what the shop lacks", async () => {
      const container = getContainer()
      const [cakilar] = await container
        .resolve(Modules.PRODUCT)
        .createProductCategories([{ name: "Çakılar", handle: "cakilar", is_active: false }])
      const run = async () =>
        (
          await applyPresetWorkflow(container).run({
            input: { pack: "general", code: "vitrin", demo: false, actor: null, packs_dir: packs },
          })
        ).result
      const library = () =>
        container.resolve<MediaModuleService>(MEDIA_MODULE).listMediaAssets({}, { select: ["id"] })

      const first = await run()
      expect(first.images).toEqual({ added: 1, kept: 0 })
      expect(first.dropped).toEqual(["home.onecikan"])
      // A record made outside the panel has no address: its link is left out, the section stays
      expect(first.skipped).toEqual([
        { where: "home.girisbolumu", ref: "/cakilar" },
        { where: "home.kategoriler", ref: "category:kiliclar" },
        { where: "home.onecikan", ref: "product:yok" },
      ])
      const draft = (await layoutRow(container))?.draft as Doc
      // A hidden category the shop has is named; it shows once opened
      expect(draft.home.map((section) => section.id)).toEqual(["girisbolumu", "kategoriler"])
      expect(draft.home[1]?.category_ids).toEqual([cakilar?.id])
      const image = draft.home[0]?.image?.url
      expect(image).toEqual(expect.any(String))
      const count = (await library()).length

      const second = await run()
      expect(second.images).toEqual({ added: 0, kept: 1 })
      expect((await library()).length).toBe(count)
      expect(((await layoutRow(container))?.draft as Doc).home[0]?.image?.url).toBe(image)
    })

    it("the provisioner's script publishes only a design never published before", async () => {
      const container = getContainer()
      const fresh = !(await layoutRow(container))?.published
      const out = jest.spyOn(process.stdout, "write").mockImplementation(() => true)
      const exec = (args: string[]) => applyPreset({ container, args })
      let lines: unknown[]
      try {
        await exec(["pack=general", "preset=grafit"])
        await exec(["pack=general", "preset=grafit"])
        await exec(["pack=general", "preset=yok"])
        // Only the result lines: the logger writes to stdout too
        lines = out.mock.calls
          .map(([line]) => readTenantResult(String(line)))
          .filter((line) => line !== null)
      } finally {
        out.mockRestore()
      }
      expect(lines).toEqual([
        {
          status: "applied",
          pack: "general",
          preset: "grafit",
          version: 1,
          skipped: 0,
          dropped: 0,
          published: fresh,
        },
        // Live now: the second stays in the draft
        expect.objectContaining({ status: "applied", published: false }),
        { status: "unknown_preset" },
      ])
      expect(process.exitCode).toBe(1)
      process.exitCode = 0
      const row = await layoutRow(container)
      expect((row?.published as { settings?: unknown } | null)?.settings).toBeDefined()
    })
  },
})
