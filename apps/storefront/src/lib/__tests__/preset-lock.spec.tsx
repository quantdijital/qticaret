import { existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { StoreLayout } from "@qticaret/types"
import type { FormAction, PlaceOrderResult } from "@qticaret/ui"
import { menusOf, packFeatures, shopFeatures } from "@/test/preset-lock/fake-store-api"
import { htmlLines, pageParts } from "@/test/preset-lock/html-lines"
import {
  LOCK_DIR,
  UPDATE_HINT,
  UPDATING,
  allPresets,
  fixtureNotes,
  header,
  styleDigests,
} from "@/test/preset-lock/presets"
import { CONTENT_FIXTURE } from "@/test/preset-lock/fixture-content"
import { lockFixtures } from "@/test/preset-lock/fixtures"
import { presetAnswer } from "@/test/preset-lock/store-layout"
import { store } from "@/test/preset-lock/store-mock"

/**
 * The preset lock (docs/tema/bilesen-standardi.md §7): a published
 * variant's drawing is not redesigned in place. Each preset under
 * `packages/sector-packs/packs/*\/presets/*` is applied to one fixed shop
 * and drawn through the storefront's own views (`shopView`, `homeSections`)
 * and the theme, its frame and its home page kept as HTML beside this
 * file (its product and category pages: `preset-lock-pages.spec.tsx`);
 * the theme's stylesheets are kept by their digests. A change that
 * moves any of them fails here until it is written again on purpose with
 * `pnpm lock:presets`.
 */

// The shop the presets are drawn in: every Store API call answered from the fixture
vi.mock("@/lib/store-api/server", () => import("@/test/preset-lock/store-mock"))
// A guest on the home page, no cookies: no customer, no cart, no preview
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-qt-url": "/" })),
  cookies: () => Promise.resolve({ get: () => undefined, getAll: () => [], has: () => false }),
}))

const { shopView } = await import("@/lib/views/shop")
const { homeSections } = await import("@/lib/views/home")
const { currentTheme } = await import("@/lib/views/theme-settings")
const { t } = await import("@/lib/i18n")
const { theme, themeFontPreloads, themeSettingsStyle } = await import("@/theme")
const { quickViewAddress } = await import("@/lib/views/quick-view")
const { SUGGEST_PATH } = await import("@/lib/views/search-suggest")

const done = (): Promise<void> => Promise.resolve()
const act: FormAction = () => Promise.resolve({ ok: true, error: null })
const subscribe = (): Promise<PlaceOrderResult> =>
  Promise.resolve({ ok: true, error: null, challenge: null })

/** The frame as `app/layout.tsx` prints it: preloads, the theme settings' style, the theme's Layout. */
async function frameHtml(): Promise<string> {
  const [shop, settings] = await Promise.all([shopView(), currentTheme()])
  const style = themeSettingsStyle(settings)
  return renderToStaticMarkup(
    <>
      {themeFontPreloads(settings).map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" />
      ))}
      {style && <style>{style}</style>}
      {createElement(theme.Layout, {
        shop,
        t,
        saveCookies: done,
        subscribe,
        searchSuggest: SUGGEST_PATH,
        changeCartLine: done,
        ...(settings.product_card.quick_view
          ? { quickView: { address: quickViewAddress(null), addToCart: act } }
          : {}),
        children: <main data-preset-lock="page" />,
      })}
    </>
  )
}

/** The home page as `app/page.tsx` prints it (its structured data aside). */
async function homeHtml(layout: StoreLayout): Promise<string> {
  const sections = await homeSections(layout.home, t)
  return renderToStaticMarkup(
    createElement(theme.HomePage, { t, view: { sections }, subscribe, quickAdd: act })
  )
}

const PRESETS = allPresets()
/** Designs no pack ships, locked beside the presets (their frame only). */
const FIXTURES = lockFixtures()

/** The pages every preset's folder keeps; the home page's sections beside them (`home-<nn>-<id>.html`). */
const LOCKED_PAGES = ["frame.html", "home.html"]

const folders = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : []

beforeAll(() => {
  // The storefront's own settings: a shop on its own address, the backend never asked
  vi.stubEnv("MEDUSA_BACKEND_URL", "http://backend.test")
  vi.stubEnv("STOREFRONT_ORIGIN", "https://ornek.example.com")
  // The footer's year and every date the page prints: one moment
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T09:00:00.000Z") })
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("the preset lock (docs/tema/bilesen-standardi.md §7)", () => {
  it("finds every preset of every pack", () => {
    expect(PRESETS.length).toBeGreaterThan(0)
  })

  it("keeps a snapshot for every preset and none for a preset that is gone", () => {
    // The content pages' folder is kept by its own spec (`preset-lock-content.spec.tsx`)
    const keys = new Set([...[...PRESETS, ...FIXTURES].map(({ key }) => key), CONTENT_FIXTURE])
    const stale = folders(LOCK_DIR).filter((name) => !keys.has(name))
    if (UPDATING) {
      stale.forEach((name) => {
        rmSync(join(LOCK_DIR, name), { recursive: true })
      })
      return
    }
    // Vitest writes a missing file snapshot on any run; a new preset's is written on purpose only
    const missing = [
      ...PRESETS.filter(
        ({ key }) => !LOCKED_PAGES.every((page) => existsSync(join(LOCK_DIR, key, page)))
      ),
      ...FIXTURES.filter(({ key }) => !existsSync(join(LOCK_DIR, key, "frame.html"))),
    ].map(({ key }) => key)
    expect(missing, `presets without a snapshot. ${UPDATE_HINT}`).toEqual([])
    expect(stale, "snapshots of presets that are gone: run `pnpm lock:presets`").toEqual([])
  })

  it.each(PRESETS)("draws $key's frame and home page as locked", async ({ key, preset }) => {
    const answer = presetAnswer(preset)
    store.layout = answer.layout
    store.menus = menusOf(preset.menus)
    shopFeatures.current = packFeatures(preset.pack)
    const notes = fixtureNotes(answer)
    const frame = header(key, notes) + htmlLines(await frameHtml())
    const home = pageParts(htmlLines(await homeHtml(answer.layout)))
    const message = (file: string) =>
      `preset ${key} is drawn differently (preset-lock/${key}/${file}). ${UPDATE_HINT}`
    const dir = join(LOCK_DIR, key)
    if (!UPDATING) {
      expect(
        existsSync(join(dir, "home.html")),
        `preset ${key} has no snapshot. ${UPDATE_HINT}`
      ).toBe(true)
    }
    // Soft: every page and section of the preset that moved is named, not the first alone
    const files = [
      { file: "frame.html", html: frame },
      { file: "home.html", html: header(key, notes) + home.page },
      ...home.sections.map((section) => ({
        file: `home-${section.name}.html`,
        html: header(key, []) + section.html,
      })),
    ]
    for (const { file, html } of files) {
      await expect.soft(html, message(file)).toMatchFileSnapshot(`./preset-lock/${key}/${file}`)
    }
    // A section the page no longer has leaves no file behind
    const drawn = new Set(home.sections.map((section) => `home-${section.name}.html`))
    const left = (existsSync(dir) ? readdirSync(dir) : []).filter(
      (name) => /^home-.+\.html$/.test(name) && !drawn.has(name)
    )
    if (UPDATING) {
      left.forEach((name) => {
        rmSync(join(dir, name))
      })
    } else {
      expect(left, message("sections gone from the page")).toEqual([])
    }
  })

  it.each(FIXTURES)("draws the $key fixture's frame as locked", async ({ key, preset }) => {
    expect(FIXTURES.length).toBeGreaterThan(0)
    const answer = presetAnswer(preset)
    store.layout = answer.layout
    store.menus = menusOf(preset.menus)
    shopFeatures.current = packFeatures(preset.pack)
    const frame = header(key, fixtureNotes(answer)) + htmlLines(await frameHtml())
    if (!UPDATING) {
      expect(existsSync(join(LOCK_DIR, key, "frame.html")), `fixture ${key}. ${UPDATE_HINT}`).toBe(
        true
      )
    }
    await expect(
      frame,
      `fixture ${key} is drawn differently (preset-lock/${key}/frame.html). ${UPDATE_HINT}`
    ).toMatchFileSnapshot(`./preset-lock/${key}/frame.html`)
  })

  it("keeps the theme's stylesheets as locked", async () => {
    const lock = `${JSON.stringify(
      {
        note: "Digests of packages/themes/atolye/src/**/*.css; written by `pnpm lock:presets`",
        files: styleDigests(),
      },
      null,
      2
    )}\n`
    await expect(
      lock,
      "the theme's style changed (packages/themes/atolye/src, preset-lock/styles.lock.json): " +
        `every preset may look different. ${UPDATE_HINT}`
    ).toMatchFileSnapshot("./preset-lock/styles.lock.json")
  })
})
