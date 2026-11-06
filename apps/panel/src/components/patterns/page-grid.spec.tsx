import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PageColumn } from "./page-grid"

// The column's height, as a rendered page would give it
let height = 0
let observed: (() => void) | undefined

class FakeResizeObserver {
  constructor(callback: () => void) {
    observed = callback
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
  return container.firstElementChild as HTMLElement
}

/** The owner, 2026-11-06: a side column never scrolls inside; taller than the window, it scrolls with the page. */
describe("PageColumn", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => height,
    })
    window.innerHeight = 900
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (offsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
    }
  })

  it("follows the scroll while it fits in the window", () => {
    height = 600
    const el = column(true)
    expect(el).toHaveClass("xl:sticky", "xl:self-start")
    expect(el).toHaveAttribute("data-sticks")
    expect(el.className).not.toMatch(/overflow|max-h/)
  })

  it("scrolls with the page once taller than the window, and follows again when it fits", () => {
    height = 1200
    const el = column(true)
    expect(el).not.toHaveClass("xl:sticky")
    expect(el).toHaveClass("xl:self-start")
    expect(el).not.toHaveAttribute("data-sticks")
    expect(el.className).not.toMatch(/overflow|max-h/)
    height = 500
    act(() => observed?.())
    expect(el).toHaveClass("xl:sticky")
  })

  it("leaves a column that does not follow the scroll alone", () => {
    height = 600
    const el = column(false)
    expect(el).not.toHaveClass("xl:sticky")
    expect(el).not.toHaveAttribute("data-layout-free")
  })
})
