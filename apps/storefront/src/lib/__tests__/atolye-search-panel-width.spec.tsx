import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { atolyeCss, ruleBody } from "@/test/atolye-css"
// The theme's own parts: it exports pages, not these
import {
  PANEL_WIDE_REM,
  panelPlace,
} from "../../../../../packages/themes/atolye/src/frame/search-panel-fit"
import { SearchPanel } from "../../../../../packages/themes/atolye/src/frame/SearchPanel"
import type { PanelModel } from "../../../../../packages/themes/atolye/src/frame/SearchPanel"

/**
 * The live search panel's width on wide screens (owner 2026-11-16,
 * adr/0049 Ek 2026-11-16): from the box's left edge, 56 rem or the box's
 * width, whichever is wider, never past the header's content edges (it
 * moves left to stay in); on a phone the stylesheet's full width stays.
 */

const WANTED = PANEL_WIDE_REM * 16
// 1440 × 900: the container 1440 px, its 48 px gutters
const EDGE = { left: 48, right: 1392 }

describe("panelPlace", () => {
  it("opens 56 rem wide from the standard header's 640 px box", () => {
    expect(panelPlace({ box: { left: 244, width: 640 }, edge: EDGE, wanted: WANTED })).toEqual({
      x: 0,
      width: 896,
    })
  })

  it("moves left so its right edge stands on the content's right edge", () => {
    // The magnifier's box opening to the left beside the tools, 40 rem
    expect(panelPlace({ box: { left: 712, width: 640 }, edge: EDGE, wanted: WANTED })).toEqual({
      x: -216,
      width: 896,
    })
  })

  it("keeps the centred header's 22 rem box's left edge", () => {
    expect(panelPlace({ box: { left: 104, width: 352 }, edge: EDGE, wanted: WANTED })).toEqual({
      x: 0,
      width: 896,
    })
  })

  it("is the box's own width when the box is wider than 56 rem", () => {
    expect(panelPlace({ box: { left: 300, width: 960 }, edge: EDGE, wanted: WANTED })).toEqual({
      x: 0,
      width: 960,
    })
  })

  it("never passes the content's left edge: on a narrow page it is the content's width", () => {
    // 1024 px, 24 px gutters: 976 px of content, wider than 56 rem
    expect(
      panelPlace({
        box: { left: 200, width: 500 },
        edge: { left: 24, right: 1000 },
        wanted: WANTED,
      })
    ).toEqual({ x: -96, width: 896 })
    // A narrow container (960 px): the panel is the content, edge to edge
    expect(
      panelPlace({
        box: { left: 300, width: 400 },
        edge: { left: 300, right: 1100 },
        wanted: WANTED,
      })
    ).toEqual({ x: 0, width: 800 })
  })
})

describe("the panel's stylesheet and columns", () => {
  it("takes the script's place and width from 1024 px only", () => {
    const css = atolyeCss("ui.css")
    expect(ruleBody(css, ".gf-suggest")).toMatch(/left: 0;\s+right: 0;/)
    const wide = css.slice(css.indexOf("@media (width >= 64rem) {\n    .gf-suggest {"))
    expect(ruleBody(wide, ".gf-suggest")).toContain("left: var(--gf-suggest-x, 0px)")
    expect(ruleBody(wide, ".gf-suggest")).toContain("width: var(--gf-suggest-w, 100%)")
    // The centred header's own 40 rem rule is gone: one rule for every header
    expect(atolyeCss("frame.css")).not.toContain('[data-variant="centered"] .gf-suggest')
  })

  it("gives the hits the room and the help a 17 rem column beside them", () => {
    const model: PanelModel = {
      kind: "results",
      q: "çakı",
      busy: false,
      none: false,
      products: [
        { id: "p1", title: "Katlanır Çakı", path: "/urun/caki", image: null, price: null },
      ],
      phrases: [],
      categories: [{ label: "Çakılar", path: "/kategori/cakilar" }],
      brands: [],
      browse: [],
      all: null,
      paths: ["/urun/caki", "/kategori/cakilar"],
    }
    const html = renderToStaticMarkup(
      createElement(SearchPanel, {
        model,
        words: {
          results: t("search.help"),
          products: t("search.suggest.products"),
          categories: t("search.suggest.categories"),
          brands: t("search.suggest.brands"),
          phrases: t("search.suggest.phrases"),
          all: t("search.suggest.all"),
          none: t("search.suggest.none"),
          browse: t("search.suggest.browse"),
          loading: t("search.suggest.loading"),
          error: t("search.suggest.error"),
          found: t("search.suggest.found"),
          priceBefore: t("price.before"),
          from: t("price.from"),
        },
        listboxId: "liste",
        optionId: (index: number) => `secenek-${String(index)}`,
        active: -1,
        hidden: false,
      })
    )
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_17rem]")
  })
})
