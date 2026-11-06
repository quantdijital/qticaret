import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PageColumn } from "./page-grid"

// The column's height and where it is drawn, as a rendered page would give them
let height = 0
let drawnAt = 0
let cellAt = 0
let resized: (() => void) | undefined
let wide = true

class FakeResizeObserver {
  constructor(callback: () => void) {
    resized = callback
  }
  observe = vi.fn()
  disconnect = vi.fn()
}

const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")

function column(sticky: boolean) {
  const { container } = render(
    <PageColumn span={4} sticky={sticky}>
      <section>Özet</section>
    </PageColumn>
  )
  const cell = container.firstElementChild as HTMLElement
  return { cell, body: cell.querySelector<HTMLElement>("[data-sticks]") }
}

const room = (cell: HTMLElement, name: string) => cell.style.getPropertyValue(name)

/**
 * The owner, 2026-11-06: a side column never scrolls inside; taller than
 * the window, it scrolls with the page and is never left behind: its end
 * stays in sight scrolling down, its start scrolling back up.
 */
describe("PageColumn", () => {
  beforeEach(() => {
    wide = true
    drawnAt = 0
    cellAt = 0
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: wide,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => height,
    })
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      const top = this.hasAttribute("data-sticks") ? drawnAt : cellAt
      return DOMRect.fromRect({ x: 0, y: top, width: 0, height })
    })
    window.innerHeight = 900
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (offsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
    }
    vi.restoreAllMocks()
  })

  it("stays under the window's top while it fits", () => {
    height = 600
    const { cell, body } = column(true)
    expect(body).toHaveClass("xl:sticky")
    expect(cell).toHaveClass("xl:col-span-4")
    expect(cell).toHaveAttribute("data-layout-free")
    // 5rem under the top; the hold from below lands on the same line
    expect(room(cell, "--sticky-top")).toBe("80px")
    expect(room(cell, "--sticky-bottom")).toBe("220px")
    expect(cell.className + (body?.className ?? "")).not.toMatch(/overflow|max-h/)
  })

  it("taller than the window, is held with its end in sight scrolling down and its start scrolling up", () => {
    height = 1200
    const { cell, body } = column(true)
    expect(body).toHaveClass("xl:sticky")
    // Its bottom 1.5rem over the window's bottom; its top no lower than 5rem
    expect(room(cell, "--sticky-top")).toBe(`${900 - 1200 - 24}px`)
    expect(room(cell, "--sticky-bottom")).toBe(`${900 - 80 - 1200}px`)
    expect(cell.className + (body?.className ?? "")).not.toMatch(/overflow|max-h/)
  })

  it("keeps its place in the flow where it is drawn, so turning the scroll back moves it at once", () => {
    height = 1200
    const { cell } = column(true)
    expect(room(cell, "--sticky-shift")).toBe("")
    // Scrolled down: the page went up 1500 px, the column is held with its end in sight
    cellAt = -1500
    drawnAt = -324
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    expect(room(cell, "--sticky-shift")).toBe("1176px")
  })

  it("is measured again when its cards open or close", () => {
    height = 600
    const { cell } = column(true)
    height = 1000
    act(() => resized?.())
    expect(room(cell, "--sticky-height")).toBe("1000px")
    expect(room(cell, "--sticky-top")).toBe(`${900 - 1000 - 24}px`)
  })

  it("does not move where the columns stack", () => {
    wide = false
    height = 1200
    const { cell, body } = column(true)
    cellAt = -1500
    drawnAt = -324
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    expect(room(cell, "--sticky-shift")).toBe("")
    expect(body).toHaveClass("max-xl:contents")
  })

  it("leaves a column that does not follow the scroll alone", () => {
    height = 600
    const { cell, body } = column(false)
    expect(body).toBeNull()
    expect(cell).not.toHaveAttribute("data-layout-free")
    expect(room(cell, "--sticky-top")).toBe("")
  })
})
