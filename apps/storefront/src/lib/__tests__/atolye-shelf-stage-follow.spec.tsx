// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SHELF_STAGE_DEFAULTS } from "@qticaret/types/section-shelf"
import type { ProductCardView, ProductsSectionView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The theme's own section: it exports pages, not this
import { StageShelf } from "../../../../../packages/themes/atolye/src/sections/ShelfStage"

/**
 * A stage list's island (adr/0049 Ek 2026-11-16): from 1024 px the row
 * under a mouse (after a short pause) or holding the focus takes the stage
 * and keeps it; a touch, or a narrower screen, changes nothing. The
 * stage's other photographs start loading once the list is entered.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const product = (id: string): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: {
    src: `/media/${id}.jpg`,
    alt: id,
    width: 800,
    height: 1000,
    sources: { avif: null, webp: null },
  },
  price: { current: "100,00 TL", before: null, from: false, discount: null },
  available: true,
})

const section = (over: Partial<ProductsSectionView> = {}) =>
  ({
    id: "raf",
    type: "products",
    title: "Raf",
    products: ["a", "b", "c", "d"].map(product),
    more: null,
    empty: "",
    variant: "stage_list",
    stage: SHELF_STAGE_DEFAULTS,
    ...over,
  }) as Parameters<typeof StageShelf>[0]["section"]

let wide = true
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  wide = true
  vi.useFakeTimers()
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return wide
    },
  }))
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const draw = (over: Partial<ProductsSectionView> = {}) => {
  act(() => {
    root.render(<StageShelf section={section(over)} t={t} />)
  })
}

const rowAt = (at: number) => {
  const row = host.querySelector(`[data-pick="${String(at)}"] a`)
  if (!row) throw new Error(`no row ${String(at)}`)
  return row
}

/** The panel the stage shows: the one not hidden. */
const shown = () =>
  [...host.querySelectorAll<HTMLElement>("[data-stage]")]
    .filter((panel) => !panel.hidden)
    .map((panel) => panel.dataset["stage"])

const marked = () =>
  [...host.querySelectorAll<HTMLElement>("[data-pick][data-on]")].map((row) => row.dataset["pick"])

const current = () =>
  [...host.querySelectorAll<HTMLElement>("[data-pick] a[aria-current='true']")].map(
    (link) => link.closest<HTMLElement>("[data-pick]")?.dataset["pick"]
  )

const point = (target: Element, pointerType: string, type = "pointerover") => {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, "pointerType", { value: pointerType })
  act(() => {
    target.dispatchEvent(event)
  })
}

describe("a stage list following its list", () => {
  it("starts with the first on the stage and its row marked", () => {
    draw()
    expect(shown()).toEqual(["0"])
    expect(marked()).toEqual(["0"])
  })

  it("puts the row under the mouse on the stage after a pause, and keeps it there", () => {
    draw()
    point(rowAt(2), "mouse")
    expect(shown()).toEqual(["0"])
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(shown()).toEqual(["2"])
    expect(marked()).toEqual(["2"])
    // Leaving the list for the stage keeps the last chosen
    point(host.querySelector("[data-stage='2']") ?? host, "mouse")
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(shown()).toEqual(["2"])
  })

  it("does not flash each row a pointer crosses on its way", () => {
    draw()
    point(rowAt(1), "mouse")
    point(rowAt(2), "mouse")
    point(rowAt(3), "pen")
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(shown()).toEqual(["3"])
  })

  it("does not choose the row a pointer leaves the list through", () => {
    draw()
    point(rowAt(3), "mouse")
    const list = host.querySelector(".gf-stage-list")
    if (!list) throw new Error("no list")
    point(list, "mouse", "pointerleave")
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(shown()).toEqual(["0"])
    expect(marked()).toEqual(["0"])
  })

  it("puts the focused row on the stage at once", () => {
    draw()
    act(() => {
      ;(rowAt(1) as HTMLElement).focus()
    })
    expect(shown()).toEqual(["1"])
    expect(marked()).toEqual(["1"])
    // A reader hears the row it chose as the current one, and only that one
    expect(current()).toEqual(["1"])
  })

  it("changes nothing under a finger or below 1024 px", () => {
    draw()
    point(rowAt(3), "touch")
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(shown()).toEqual(["0"])
    // A tap focuses the link on its way to the product: still not a choice
    point(rowAt(2), "touch", "pointerdown")
    act(() => {
      ;(rowAt(2) as HTMLElement).focus()
    })
    expect(shown()).toEqual(["0"])
    expect(current()).toEqual(["0"])
    // The keyboard after it chooses again
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }))
      ;(rowAt(1) as HTMLElement).focus()
    })
    expect(shown()).toEqual(["1"])
    wide = false
    act(() => {
      ;(rowAt(2) as HTMLElement).focus()
    })
    expect(shown()).toEqual(["1"])
  })

  it("lets the stage's other photographs load once the list is entered", () => {
    draw()
    const images = [...host.querySelectorAll<HTMLImageElement>("[data-stage] img")]
    expect(images.map((image) => image.getAttribute("loading"))).toEqual([
      "lazy",
      "lazy",
      "lazy",
      "lazy",
    ])
    point(rowAt(1), "mouse")
    expect(images.map((image) => image.getAttribute("loading"))).toEqual([
      "eager",
      "eager",
      "eager",
      "eager",
    ])
  })

  it("has no island when the stage does not follow", () => {
    draw({ stage: { ...SHELF_STAGE_DEFAULTS, stage_follow: "off" } })
    expect(host.querySelector("[data-pick]")).toBeNull()
    expect(host.querySelectorAll("[data-stage]")).toHaveLength(1)
  })
})
