import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DEFAULT_PACKS_DIR } from "@qticaret/sector-packs"
import sharp from "sharp"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { SECTOR_PACKS_MODULE } from "../../src/modules/sector-packs"
import type SectorPacksModuleService from "../../src/modules/sector-packs/service"
import { STOREFRONT_LAYOUT_MODULE } from "../../src/modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../src/modules/storefront-layout/service"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { applyPresetWorkflow } from "../../src/workflows/storefront/preset-apply"
import applyPreset from "../../src/scripts/apply-preset"
import { readTenantResult } from "@qticaret/types/control-plane"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

type Doc = Record<string, unknown> & {
  header?: { id: string; type: string }[]
  footer?: { id: string; type: string }[]
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
    kept: string[]
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
  // A preset with menus only: its header menu's one link answers nothing here, no footer
  const menulu = join(root, "general", "presets", "menulu")
  mkdirSync(menulu, { recursive: true })
  copyFileSync(join(preset, "theme.json"), join(menulu, "theme.json"))
  const write = (name: string, value: unknown) => {
    writeFileSync(join(menulu, name), JSON.stringify(value))
  }
  write("preset.json", {
    format: "quant-storefront-preset",
    code: "menulu",
    version: 1,
    theme: "atolye",
    name: "Menülü",
    description: "Menüleri olan deneme görünümü.",
    tone: "light",
    credits: [],
  })
  write("layout.json", {
    home: [{ id: "yardim", type: "help", ...SCHEDULE, title: "Bize yazın", text: null }],
  })
  write("menus.json", [
    {
      title: "Ana menü",
      location: "main",
      items: [{ label: "Kayıp", href: "/yok-boyle-bir-yer" }],
    },
    { title: "Üst satır", location: "top", items: [{ label: "Blog", href: "/blog" }] },
  ])
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

      // The shop's own design, live, with its own trust badges, an announcement bar and a
      // home page of one section
      const opened = await admin()
      const badges = [{ icon: "truck", title: "Aynı gün kargo", text: null }]
      const bar = {
        id: "duyurular",
        type: "announcement_bar",
        ...SCHEDULE,
        lines: ["Kargo bedava"],
      }
      const own = {
        ...opened.draft,
        header: [bar],
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
        // Grafit writes no header: the shop's announcement bar stays, and the answer says so
        kept: ["header.duyurular"],
        images: { added: 0, kept: 0 },
        demo: { added: 0, kept: 0 },
      })
      const draft = first.data.layout.draft
      // The header bar read in from grafit's theme header (adr/0049 Ek 2026-11-14 §5)
      expect(draft.header).toEqual([
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
          visible: true,
          starts_at: null,
          ends_at: null,
          variant: "standard",
          sticky: true,
          menu_images: "submenus",
          search_style: "field",
        },
      ])
      // Grafit fills the footer: its own stands (after the footer, read in)
      expect(draft.footer?.map((section) => section.id)).toEqual(["mainfooter", "ebultenkutusu"])
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
        // Grafit's own steps (2026-11-16, adr/0067 Ek): gentle corners, compact sections, balanced room
        expect.objectContaining({
          theme: "atolye",
          radius: "gentle",
          buttons: "pill",
          section_spacing: "compact",
          density: "balanced",
        })
      )
      expect(first.data.layout.has_changes).toBe(true)
      expect((await layoutRow(container))?.published).toEqual(live)

      const second = await apply("general", "grafit")
      expect(second.status).toBe(200)
      expect(second.data.layout.draft).toEqual(draft)
      expect((await layoutRow(container))?.published).toEqual(live)

      // One audit entry per apply: the admin log's, with the request's status and the preset named
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const applied = async () =>
        audit.listAuditEntries(
          { action: "POST /admin/storefront-presets/:pack/:code/apply", outcome: 200 },
          { select: ["resource_type", "resource_id", "actor_id", "changes"] }
        )
      for (let attempt = 0; attempt < 30 && (await applied()).length < 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      const entries = await applied()
      expect(entries).toHaveLength(2)
      expect(entries[0]).toMatchObject({
        resource_type: "storefront_layout",
        resource_id: "general/grafit",
      })
      const codes = entries.map(
        (entry) =>
          (entry.changes as { diff?: Record<string, { after?: unknown }> } | null)?.diff?.[
            "preset.code"
          ]?.after
      )
      // The first named the preset in the draft; the second changed nothing
      expect(codes).toContain("grafit")
      expect(await audit.listAuditEntries({ action: "storefront_layout.preset_applied" })).toEqual(
        []
      )

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

      // The shop deletes the image; two applies at once upload it once, and the ledger names it
      const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
      const [uploaded] = await media.listMediaAssets({ url: image }, { select: ["id"] })
      await media.deleteMediaAssets([uploaded?.id ?? ""])
      const both = await Promise.all([run(), run()])
      expect(both.map((each) => each.images.added).sort()).toEqual([0, 1])
      expect((await library()).length).toBe(count)
      const ledger = container.resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      const rows = await ledger.listSectorPackItems(
        { kind: "preset_image" },
        { select: ["record_id"] }
      )
      const named = await media.listMediaAssets(
        { id: rows.flatMap((row) => (row.record_id ? [row.record_id] : [])) },
        { select: ["id"] }
      )
      expect(named.length).toBe(rows.length)

      // A new version changes the picture under the same name: uploaded again
      const before = ((await layoutRow(container))?.draft as Doc).home[0]?.image?.url
      writeFileSync(
        join(packs, "general", "presets", "vitrin", "images", "hero.png"),
        await sharp({
          create: { width: 96, height: 64, channels: 3, background: { r: 200, g: 60, b: 40 } },
        })
          .png()
          .toBuffer()
      )
      const changed = await run()
      expect(changed.images).toEqual({ added: 1, kept: 0 })
      const after = ((await layoutRow(container))?.draft as Doc).home[0]?.image?.url
      expect(after).toEqual(expect.any(String))
      expect(after).not.toBe(before)
    })

    it("keeps the shop's live menus where the preset leaves a place, through the publication", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      const system = (target: string, label: string | null = null) => ({
        link: { kind: "system", target, label },
      })
      for (const menu of [
        { title: "Mağaza menüsü", location: "main", items: [system("home", "Anasayfa")] },
        { title: "Kurumsal", location: "footer", items: [system("blog")] },
      ]) {
        expect((await settle(http.post("/admin/storefront-menus", menu, asOwner))).status).toBe(201)
      }
      interface AdminMenu {
        title: string
        location: string
        items: { kind: string; target: string | null; label: string | null }[]
      }
      const menus = async () =>
        (await settle(http.get<{ menus: AdminMenu[] }>("/admin/storefront-menus", asOwner))).data
          .menus
      const at = (list: AdminMenu[], location: string) =>
        list
          .filter((menu) => menu.location === location)
          .map(({ title, items }) => ({
            title,
            items: items.map(({ kind, target, label }) => ({ kind, target, label })),
          }))
      const before = await menus()

      const { result } = await applyPresetWorkflow(container).run({
        input: { pack: "general", code: "menulu", demo: false, actor: null, packs_dir: packs },
      })
      // The header menu's every link is gone: the shop's own is kept, and the answer says so
      expect(result.skipped).toContainEqual({ where: "menus", ref: "main", kept_live: true })
      const set = ((await layoutRow(container))?.draft as Doc).settings["menus"] as {
        title: string
        location: string
      }[]
      expect(set.map(({ location, title }) => `${location}:${title}`).sort()).toEqual([
        "footer:Kurumsal",
        "main:Mağaza menüsü",
        "top:Üst satır",
      ])

      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const after = await menus()
      // (a) the header menu as it was; (b) the footer the preset names none of, still there
      expect(at(after, "main")).toEqual(at(before, "main"))
      expect(at(after, "footer")).toEqual(at(before, "footer"))
      expect(at(after, "top")).toEqual([
        { title: "Üst satır", items: [{ kind: "system", target: "blog", label: "Blog" }] },
      ])
    })

    it("keeps the shop's settings an editor saves while the preset waits for the design", async () => {
      const container = getContainer()
      const run = () =>
        applyPresetWorkflow(container).run({
          input: { pack: "general", code: "grafit", demo: false, actor: null },
        })
      await run()
      const locking = container.resolve(Modules.LOCKING)
      const owner = "test-editor"
      await locking.acquire("storefront-layout", { ownerId: owner, expire: 30 })
      let done = false
      const applying = run().finally(() => {
        done = true
      })
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        // It waits for the design's lock before reading what it keeps
        expect(done).toBe(false)
        // The editor's save, under the lock: new trust badges
        const row = await layoutRow(container)
        const draft = row?.draft as Doc
        const badges = [{ icon: "truck", title: "Kapıda ödeme", text: null }]
        await container
          .resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)
          .updateStorefrontLayouts({
            id: row?.id ?? "",
            draft: { ...draft, settings: { ...draft.settings, trust_badges: badges } },
          })
      } finally {
        await locking.release("storefront-layout", { ownerId: owner })
      }
      await applying
      const kept = ((await layoutRow(container))?.draft as Doc).settings.trust_badges
      expect(kept).toEqual([{ icon: "truck", title: "Kapıda ödeme", text: null }])
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
      // With no staff member, the workflow records each apply and the script its publication
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const entries = await audit.listAuditEntries(
        { action: ["storefront_layout.preset_applied", "storefront_layout.published"] },
        { select: ["action", "actor_type", "resource_id"] }
      )
      expect(entries.filter((each) => each.action === "storefront_layout.preset_applied")).toEqual([
        expect.objectContaining({ actor_type: "system", resource_id: "general/grafit" }),
        expect.objectContaining({ actor_type: "system", resource_id: "general/grafit" }),
      ])
      expect(entries.filter((each) => each.action === "storefront_layout.published").length).toBe(
        fresh ? 1 : 0
      )
    })
  },
})
