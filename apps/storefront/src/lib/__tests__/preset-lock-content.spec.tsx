import { existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { menusOf } from "@/test/preset-lock/fake-store-api"
import {
  ABOUT_PAGE,
  CONTACT_PAGE,
  CONTENT_FIXTURE,
  STORY_PAGE,
  contentAnswerOf,
  contentEntity,
} from "@/test/preset-lock/fixture-content"
import { presetContentPages } from "@/test/preset-lock/fixture-content-presets"
import { htmlLines } from "@/test/preset-lock/html-lines"
import { LOCK_DIR, UPDATE_HINT, UPDATING, allPresets, header } from "@/test/preset-lock/presets"
import { presetAnswer } from "@/test/preset-lock/store-layout"
import { store } from "@/test/preset-lock/store-mock"

/**
 * The preset lock's content pages (docs/tema/bilesen-standardi.md §7;
 * adr/0073 §2, S3): a page of the shop's own words with its cover, the
 * contact page with its form, and a page with its own sections above and
 * below its text, drawn in the fixed shop through the
 * storefront's own screen (`ContentScreen`) and the theme, kept in
 * `preset-lock/fixture-content-pages/`. A page with no layout of its own
 * is drawn as it was before content pages took sections: these files are
 * that proof, never written again to let a change through. A preset that
 * lays out one of these pages (Katalog's Hakkımızda, adr/0073 §4) has it
 * drawn with its sections in its own folder (`cutlery-katalog/about.html`).
 */

vi.mock("@/lib/store-api/server", () => import("@/test/preset-lock/store-mock"))
// A guest, no cookies: no customer, no preview
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-qt-url": "/" })),
  cookies: () => Promise.resolve({ get: () => undefined, getAll: () => [], has: () => false }),
}))

const { ContentScreen } = await import("@/screens/content")

/** The page as the catch-all route prints it: the screen, its structured data and the theme's page. */
async function contentHtml(page: typeof ABOUT_PAGE): Promise<string> {
  return renderToStaticMarkup(await ContentScreen({ page: contentEntity(page) }))
}

const PAGES = [
  // Written before content pages took sections (adr/0073 S3): never again to let a change through
  { file: "page.html", page: ABOUT_PAGE },
  { file: "contact.html", page: CONTACT_PAGE },
  // A page with its own sections: a rich text above its text, three sections below it
  { file: "page-sections.html", page: STORY_PAGE },
]

beforeAll(() => {
  vi.stubEnv("MEDUSA_BACKEND_URL", "http://backend.test")
  vi.stubEnv("STOREFRONT_ORIGIN", "https://ornek.example.com")
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T09:00:00.000Z") })
  const base = allPresets()[0]?.preset
  if (!base) {
    throw new Error("preset lock: no preset to draw the content pages in")
  }
  store.layout = presetAnswer(base).layout
  store.menus = menusOf(base.menus)
  store.answer = contentAnswerOf(base)
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("the preset lock's content pages (docs/tema/bilesen-standardi.md §7, adr/0073)", () => {
  it.each(PAGES)("draws the $file content page as locked", async ({ file, page }) => {
    if (!UPDATING) {
      expect(
        existsSync(join(LOCK_DIR, CONTENT_FIXTURE, file)),
        `${CONTENT_FIXTURE} has no ${file} snapshot. ${UPDATE_HINT}`
      ).toBe(true)
    }
    const html = header(CONTENT_FIXTURE, []) + htmlLines(await contentHtml(page))
    await expect(
      html,
      `the content page is drawn differently (preset-lock/${CONTENT_FIXTURE}/${file}). ${UPDATE_HINT}`
    ).toMatchFileSnapshot(`./preset-lock/${CONTENT_FIXTURE}/${file}`)
  })
})

/** Each preset's own content page layouts on the fixture's pages (adr/0073 §4, S5). */
const PRESET_PAGES = allPresets().flatMap(({ key, preset }) => {
  const own = presetContentPages(preset)
  return own.pages.map(({ file, page }) => ({ key, file, page, preset, own }))
})

describe("the preset lock's content page layouts (docs/tema/bilesen-standardi.md §7, adr/0073)", () => {
  it("finds a preset laying out a fixture page", () => {
    expect(PRESET_PAGES.length).toBeGreaterThan(0)
  })

  it.each(PRESET_PAGES)(
    "draws $key's $file as locked",
    async ({ key, file, page, preset, own }) => {
      store.layout = presetAnswer(preset).layout
      store.menus = menusOf(preset.menus)
      store.answer = contentAnswerOf(preset, own.layouts)
      if (!UPDATING) {
        expect(
          existsSync(join(LOCK_DIR, key, file)),
          `preset ${key} has no ${file} snapshot. ${UPDATE_HINT}`
        ).toBe(true)
      }
      const html = header(key, own.notes) + htmlLines(await contentHtml(page))
      await expect(
        html,
        `preset ${key}'s page is drawn differently (preset-lock/${key}/${file}). ${UPDATE_HINT}`
      ).toMatchFileSnapshot(`./preset-lock/${key}/${file}`)
    }
  )
})
