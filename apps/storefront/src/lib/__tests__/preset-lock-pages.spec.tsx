import { existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Resolution } from "@qticaret/types"
import { menusOf, packFeatures, shopFeatures } from "@/test/preset-lock/fake-store-api"
import { pageAnswer } from "@/test/preset-lock/fake-page-api"
import { PAGE_CATEGORY, PAGE_CATEGORY_PATH, PAGE_PRODUCT } from "@/test/preset-lock/fixture-pages"
import { htmlLines } from "@/test/preset-lock/html-lines"
import {
  LOCK_DIR,
  UPDATE_HINT,
  UPDATING,
  allPresets,
  fixtureNotes,
  header,
} from "@/test/preset-lock/presets"
import { presetAnswer } from "@/test/preset-lock/store-layout"
import { store } from "@/test/preset-lock/store-mock"

/**
 * The preset lock's product and category pages (docs/tema/bilesen-standardi.md
 * §7; adr/0067 step 0): beside each preset's frame and home page
 * (`preset-lock.spec.tsx`), its product page and its category page, drawn
 * in the same fixed shop through the storefront's own screens
 * (`ProductScreen`, `ListingScreen`) and the theme, kept as
 * `product.html` and `listing.html` in the preset's folder. The product
 * has options whose variants are on sale, nearly sold out and sold out;
 * the category page has filters, a sort, pages and cards
 * (`fixture-pages.ts`).
 */

vi.mock("@/lib/store-api/server", () => import("@/test/preset-lock/store-mock"))
// A guest, no cookies: no customer, no cart, no preview
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-qt-url": "/" })),
  cookies: () => Promise.resolve({ get: () => undefined, getAll: () => [], has: () => false }),
}))

const { ProductScreen } = await import("@/screens/product")
const { ListingScreen } = await import("@/screens/listing")

const ORIGIN = "https://ornek.example.com"

const entity = (
  path: string,
  type: "product" | "product_category",
  id: string
): Extract<Resolution, { type: "entity" }> => ({
  type: "entity",
  path,
  entity_type: type,
  entity_id: id,
  seo: null,
})

/** The product page as `/urun/[...]` prints it: the screen, its variant not asked. */
async function productHtml(): Promise<string> {
  const path = `/urun/${PAGE_PRODUCT.handle}`
  const screen = await ProductScreen({
    page: entity(path, "product", PAGE_PRODUCT.id),
    url: new URL(`${ORIGIN}${path}`),
  })
  return renderToStaticMarkup(screen)
}

/**
 * The category page's first page as the listing route prints it. The
 * screen hands its work to an async component, which a static render does
 * not wait for: it is called here with the props the screen gave it.
 */
async function listingHtml(): Promise<string> {
  const screen = ListingScreen({
    page: entity(PAGE_CATEGORY_PATH, "product_category", PAGE_CATEGORY),
    url: new URL(`${ORIGIN}${PAGE_CATEGORY_PATH}`),
  })
  const content = screen.type as (props: unknown) => Promise<ReactElement>
  return renderToStaticMarkup(await content(screen.props))
}

const PRESETS = allPresets()

/** The pages this spec keeps in every preset's folder. */
const LOCKED_PAGES = ["product.html", "listing.html"]

beforeAll(() => {
  vi.stubEnv("MEDUSA_BACKEND_URL", "http://backend.test")
  vi.stubEnv("STOREFRONT_ORIGIN", ORIGIN)
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T09:00:00.000Z") })
  store.answer = pageAnswer
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("the preset lock's product and category pages (docs/tema/bilesen-standardi.md §7)", () => {
  it("keeps a product and a category page snapshot for every preset", () => {
    if (UPDATING) {
      return
    }
    // Vitest writes a missing file snapshot on any run; a new preset's is written on purpose only
    const missing = PRESETS.flatMap(({ key }) =>
      LOCKED_PAGES.filter((page) => !existsSync(join(LOCK_DIR, key, page))).map(
        (page) => `preset-lock/${key}/${page}`
      )
    )
    expect(missing, `presets without a snapshot. ${UPDATE_HINT}`).toEqual([])
  })

  it.each(PRESETS)("draws $key's product and category pages as locked", async ({ key, preset }) => {
    const answer = presetAnswer(preset)
    store.layout = answer.layout
    store.menus = menusOf(preset.menus)
    shopFeatures.current = packFeatures(preset.pack)
    const notes = fixtureNotes(answer)
    const files = [
      { file: "product.html", html: header(key, notes) + htmlLines(await productHtml()) },
      { file: "listing.html", html: header(key, notes) + htmlLines(await listingHtml()) },
    ]
    for (const { file, html } of files) {
      if (!UPDATING) {
        expect(
          existsSync(join(LOCK_DIR, key, file)),
          `preset ${key} has no ${file} snapshot. ${UPDATE_HINT}`
        ).toBe(true)
      }
      // Soft: both pages that moved are named, not the first alone
      await expect
        .soft(
          html,
          `preset ${key} is drawn differently (preset-lock/${key}/${file}). ${UPDATE_HINT}`
        )
        .toMatchFileSnapshot(`./preset-lock/${key}/${file}`)
    }
  })
})
