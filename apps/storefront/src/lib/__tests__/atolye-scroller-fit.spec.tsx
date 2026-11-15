// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"
// The theme's own part: it exports pages, not this
import { Scroller } from "../../../../../packages/themes/atolye/src/parts/Scroller"

/**
 * The scroller kit with nothing to scroll (fifth audit V-04): when every
 * card is in view no arrows and no dots show (no two dead arrows); a
 * resize that makes the row overflow brings them back. Before the script
 * measures (the server's page) the arrows are drawn as ever.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const words = {
  label: "Raf",
  previous: "Öncekiler",
  next: "Sonrakiler",
  play: "Oynat",
  pause: "Durdur",
  page: "{n}. sayfa",
  pages: "Sayfalar",
}
const settings = { ...SCROLLER_DEFAULTS, dots: "on" as const }

/** The row's measured widths, as the test sets them. */
const size = { scroll: 0, client: 0 }
let resized: (() => void) | null = null

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  size.scroll = 1000
  size.client = 1000
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => size.scroll)
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => size.client)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback
      }
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
  resized = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const row = (count: number) => (
  <Scroller settings={settings} words={words}>
    {Array.from({ length: count }, (_, index) => (
      <span key={index}>{`Kart ${String(index)}`}</span>
    ))}
  </Scroller>
)

const arrow = (name: string) => host.querySelector(`button[aria-label="${name}"]`)

describe("the scroller kit when the cards fit", () => {
  it("draws the arrows on the server's page, before anything is measured", () => {
    const html = renderToString(row(4))
    expect(html).toContain('aria-label="Öncekiler"')
    expect(html).toContain('aria-label="Sonrakiler"')
  })

  it("hides the arrows and the dots while every card is in view", () => {
    act(() => {
      root.render(row(4))
    })
    expect(arrow("Öncekiler")).toBeNull()
    expect(arrow("Sonrakiler")).toBeNull()
    expect(host.querySelector('[role="group"]')).toBeNull()
  })

  it("brings them back when a resize makes the row overflow", () => {
    act(() => {
      root.render(row(8))
    })
    expect(arrow("Sonrakiler")).toBeNull()
    size.client = 500
    act(() => {
      resized?.()
    })
    expect(arrow("Öncekiler")).not.toBeNull()
    expect(arrow("Sonrakiler")).not.toBeNull()
    expect(host.querySelectorAll('[role="group"] button')).toHaveLength(2)
  })
})
