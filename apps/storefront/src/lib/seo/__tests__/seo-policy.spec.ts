import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { SeoPayload } from "@qticaret/types"
import { metadataOf } from "../metadata"

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Every source file under `dir`, tests left out. */
function sources(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !/node_modules|__tests__|\.spec\.|\/e2e\//.test(path))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }))
}

const STOREFRONT = root("../../../")
const THEMES = root("../../../../../../packages/themes/")
const UI = root("../../../../../../packages/ui/src/")

/**
 * docs/13 §5: no `FAQPage` structured data. Google shows FAQ rich results
 * only for well-known government and health sites since 2023 and has since
 * dropped them; a shop's FAQ stays on the page for its readers, never as
 * schema (adr/0049 Ek 2026-11-06).
 */
describe("structured data", () => {
  it("writes no FAQPage anywhere: storefront, themes, ui", () => {
    const writers = [...sources(STOREFRONT), ...sources(THEMES), ...sources(UI)].filter(
      // As a JSON-LD type: a string, not a comment's name for it
      ({ text }) => /["']FAQPage["']/.test(text)
    )
    expect(writers.map(({ path }) => path)).toEqual([])
  })
})

/**
 * The shop's name once in a title (docs/21 2026-11-06, 7): the backend's
 * title is final, the storefront adds no template of its own (Next's
 * `title.template` would add the name a second time).
 */
describe("titles", () => {
  it("print the backend's title as it is", () => {
    const seo = {
      title: "Keten Gömlek | Demo Mağaza",
      description: "",
      canonical: null,
      robots: "index,follow",
      openGraph: {
        title: "Keten Gömlek | Demo Mağaza",
        description: "",
        image: null,
        imageAlt: null,
        type: "website",
        url: null,
        siteName: "Demo Mağaza",
      },
      twitter: {
        card: "summary",
        title: "Keten Gömlek | Demo Mağaza",
        description: "",
        image: null,
      },
      breadcrumbs: [],
      jsonLd: [],
      hreflang: [],
    } as unknown as SeoPayload
    expect(metadataOf(seo).title).toEqual({ absolute: "Keten Gömlek | Demo Mağaza" })
  })

  it("have no template in any layout or page", () => {
    const templated = sources(root("../../../app/")).filter(({ text }) =>
      /title:\s*\{[^}]*\btemplate\s*:/.test(text)
    )
    expect(templated.map(({ path }) => path)).toEqual([])
  })
})
