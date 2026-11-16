// @vitest-environment jsdom
import { act, createElement, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
// The theme's own part: it exports pages, not this
import { usePanelFit } from "../../../../../packages/themes/atolye/src/frame/search-panel-fit"

/**
 * The live search panel's measuring on wide screens (owner 2026-11-16):
 * the box and the header row's content give the panel's place and width
 * (`panelPlace`, atolye-search-panel-width.spec); on a phone nothing is set.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("usePanelFit", () => {
  let host: HTMLDivElement | null = null
  let root: Root | null = null

  afterEach(() => {
    act(() => root?.unmount())
    host?.remove()
    vi.unstubAllGlobals()
  })

  const box = (left: number, width: number) =>
    ({ left, width, right: left + width, top: 0, bottom: 48, height: 48, x: left, y: 0 }) as DOMRect

  function Fit({ shown }: { shown: boolean }) {
    const form = useRef<HTMLFormElement>(null)
    const panel = useRef<HTMLDivElement>(null)
    usePanelFit(form, panel, shown)
    return createElement(
      "div",
      { "data-gf-head-row": "", style: { paddingLeft: "48px", paddingRight: "48px" } },
      createElement("form", { ref: form }, createElement("div", { ref: panel, "data-panel": "" }))
    )
  }

  function draw(wide: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: wide, media: query }))
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this.hasAttribute("data-gf-head-row") ? box(0, 1440) : box(712, 640)
    })
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
    act(() => root?.render(createElement(Fit, { shown: true })))
    return host.querySelector<HTMLElement>("[data-panel]")
  }

  it("sets the wide panel's place and width from the header row's content", () => {
    const panel = draw(true)
    expect(panel?.style.getPropertyValue("--gf-suggest-x")).toBe("-216px")
    expect(panel?.style.getPropertyValue("--gf-suggest-w")).toBe("896px")
  })

  it("sets nothing on a phone: the panel keeps the box's full width", () => {
    const panel = draw(false)
    expect(panel?.style.getPropertyValue("--gf-suggest-x")).toBe("")
    expect(panel?.style.getPropertyValue("--gf-suggest-w")).toBe("")
  })
})
