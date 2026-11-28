import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DEFAULT_PACKS_DIR, storefrontPreset } from "@qticaret/sector-packs"
import { FIXTURE_PACKS_DIR } from "../../src/lib/storefront/presets/__tests__/fixture-packs"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { applyPresetWorkflow } from "../../src/workflows/storefront/preset-apply"
import { createAdminUser } from "../helpers/admin"
import { LOOK, withCutlery } from "../helpers/designs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface Applied {
  result: {
    skipped: { where: string; ref: string; name?: string; reason?: string }[]
    made_pages: { ref: string; page_id: string; name: string }[]
    texts_kept: { ref: string; name?: string }[]
    dropped_pages: number
  }
  layout: { draft: { pages: { page_id: string; sections: Section[] }[] } }
}

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }

/** The starter pages every look lays out (adr/0073 Ek 2026-11-28), in Katalog's order. */
const STARTERS = [
  { ref: "page:hakkimizda", name: "Hakkımızda" },
  { ref: "page:iletisim", name: "İletişim" },
  { ref: "page:sik-sorulan-sorular", name: "Sık Sorulan Sorular" },
  { ref: "page:odeme-secenekleri", name: "Ödeme Seçenekleri" },
  { ref: "page:kargo-ve-teslimat", name: "Kargo ve Teslimat" },
]

/**
 * A `general` pack whose one look lays out Hakkımızda with a text naming
 * a `{belirteç}` no shop has: the design's schema takes it, the draft's
 * check refuses it, after the page was opened.
 */
function brokenPack(): string {
  const root = mkdtempSync(join(tmpdir(), "presets-open-"))
  const preset = join(root, "general", "presets", "bozuk")
  mkdirSync(preset, { recursive: true })
  copyFileSync(
    join(DEFAULT_PACKS_DIR, "general", "manifest.json"),
    join(root, "general", "manifest.json")
  )
  const sade = join(FIXTURE_PACKS_DIR, "general", "presets", "sade")
  cpSync(sade, join(root, "general", "presets", "sade"), { recursive: true })
  copyFileSync(join(sade, "theme.json"), join(preset, "theme.json"))
  const json = (name: string, value: unknown) => {
    writeFileSync(join(preset, name), JSON.stringify(value))
  }
  json("preset.json", {
    format: "quant-storefront-preset",
    code: "bozuk",
    version: 1,
    theme: "atolye",
    name: "Bozuk",
    description: "Testin görünümü.",
    tone: "light",
  })
  json("layout.json", {
    pages: [
      {
        page_id: { $handle: "page:hakkimizda" },
        name: "Hakkımızda",
        sections: [
          {
            id: "bozukmetin1",
            type: "rich_text",
            variant: "article",
            ...SCHEDULE,
            title: null,
            body: {
              type: "doc",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "{olmayan_belirtec}" }] },
              ],
            },
          },
        ],
      },
    ],
  })
  return root
}

/**
 * adr/0073 Ek 2026-11-19 (2) K6: a page the look lays out and the shop
 * has not made is opened as a draft (`made_pages`) under the look's name
 * and the handle's address; an address another record holds is skipped
 * (`taken`); a later step failing deletes the page again.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("opens a missing page as a draft with the look's layout and text, once", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      await withCutlery(container)
      const katalog = storefrontPreset(LOOK.pack, LOOK.code)
      const apply = () =>
        settle(
          http.post<Applied>(
            `/admin/storefront-presets/${LOOK.pack}/${LOOK.code}/apply`,
            {},
            asOwner
          )
        )

      const first = await apply()

      expect(first.status).toBe(200)
      const [made] = first.data.result.made_pages
      expect(first.data.result.made_pages).toEqual(
        STARTERS.map((page) => ({ ...page, page_id: expect.stringMatching(/^cnt_/) as unknown }))
      )
      // Every page opened is a draft under the look's name, at the handle's address (K6)
      const opened = await container
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listContentEntries(
          { id: first.data.result.made_pages.map((page) => page.page_id) },
          { select: ["title", "handle", "status", "published_at"] }
        )
      expect(
        opened.map((each) => ({ ...each })).sort((a, b) => a.handle.localeCompare(b.handle))
      ).toEqual(
        STARTERS.map((page) => ({
          title: page.name,
          handle: page.ref.slice("page:".length),
          status: "draft",
          published_at: null,
        })).sort((a, b) => a.handle.localeCompare(b.handle))
      )
      // The role pages laid out with their live facts, the contact page with its form
      const typesOf = (ref: string) =>
        first.data.layout.draft.pages
          .find(
            (page) =>
              page.page_id ===
              first.data.result.made_pages.find((each) => each.ref === ref)?.page_id
          )
          ?.sections.map((section) => section.type)
      expect(typesOf("page:odeme-secenekleri")).toEqual(["rich_text", "payment_facts"])
      expect(typesOf("page:kargo-ve-teslimat")).toEqual(["rich_text", "shipping_facts"])
      expect(typesOf("page:iletisim")).toEqual(["contact"])
      expect(typesOf("page:sik-sorulan-sorular")).toEqual(["faq"])
      expect(first.data.result.skipped.filter((each) => each.where === "pages")).toEqual([])
      expect(first.data.result.texts_kept).toEqual([])
      const entry = await settle(
        http.get<{ entry: { title: string; handle: string; status: string } }>(
          `/admin/content/${made?.page_id ?? ""}`,
          asOwner
        )
      )
      expect(entry.data.entry).toMatchObject({
        title: "Hakkımızda",
        handle: "hakkimizda",
        status: "draft",
      })
      // The look's own layout and text on it (K9)
      const page = first.data.layout.draft.pages.find((each) => each.page_id === made?.page_id)
      expect(page).toBeDefined()
      expect(page?.sections.map((section) => section.id)).toEqual(
        katalog?.layout.pages?.[0]?.sections.map((section) => section.id)
      )
      // Applied again: the page is the shop's now, none opened twice
      const second = await apply()
      expect(second.status).toBe(200)
      expect(second.data.result.made_pages).toEqual([])
      expect(second.data.layout.draft.pages).toEqual(first.data.layout.draft.pages)
      const pages = await container
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listContentEntries({ kind: "page", handle: "hakkimizda" }, { select: ["id"] })
      expect(pages.map((each) => each.id)).toEqual([made?.page_id])
    })

    it("skips a page whose address another record holds (a deleted live page's 410)", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const asOwner = { headers: owner.headers }
      await withCutlery(container)
      const live = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "page", title: "Hakkımızda", handle: "hakkimizda", status: "published" },
            asOwner
          )
        )
      ).data.entry.id
      expect((await settle(http.delete(`/admin/content/${live}`, asOwner))).status).toBe(200)

      const applied = await settle(
        http.post<Applied>(`/admin/storefront-presets/${LOOK.pack}/${LOOK.code}/apply`, {}, asOwner)
      )

      // Warn, don't block: the look is applied, the page's layout left out and named
      expect(applied.status).toBe(200)
      // The other starter pages opened as drafts
      expect(applied.data.result.made_pages.map((page) => page.ref)).toEqual(
        STARTERS.slice(1).map((page) => page.ref)
      )
      expect(applied.data.result.skipped).toContainEqual({
        where: "pages",
        ref: "page:hakkimizda",
        name: "Hakkımızda",
        reason: "taken",
      })
      expect(applied.data.layout.draft.pages.map((page) => page.page_id)).toEqual(
        applied.data.result.made_pages.map((page) => page.page_id)
      )
    })

    it("deletes the page it opened when a later step fails, the draft untouched", async () => {
      const container = getContainer()
      const packs = brokenPack()
      try {
        const before = (await layoutRow(container))?.draft ?? null

        const failed = await applyPresetWorkflow(container)
          .run({
            input: { pack: "general", code: "bozuk", demo: false, actor: null, packs_dir: packs },
          })
          .then(
            () => null,
            (error: unknown) => (error as { message?: string } | null)?.message ?? String(error)
          )

        // Refused by the draft's check, after the page was opened
        expect(failed).not.toBeNull()
        const pages = await container
          .resolve<ContentModuleService>(CONTENT_MODULE)
          .listContentEntries({ kind: "page", handle: "hakkimizda" }, { select: ["id"] })
        expect(pages).toEqual([])
        expect((await layoutRow(container))?.draft ?? null).toEqual(before)
      } finally {
        rmSync(packs, { recursive: true, force: true })
      }
    })
  },
})
