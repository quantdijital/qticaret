// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { ANNOUNCEMENT_DEFAULTS } from "@qticaret/types/section-announcement"
import type { AnnouncementSettings } from "@qticaret/types"
import { renderFrame, shopFixture } from "@/test/theme-render"
// The theme's own part: it exports pages, not this
import {
  ANNOUNCEMENT_INTERVAL,
  AnnouncementTurns,
} from "../../../../../packages/themes/atolye/src/frame/AnnouncementTurns"

/**
 * The announcement bar's several lines in Atölye (docs/tema/bilesen-
 * denetimi (b) 6): the first alone by default, side by side on a wide
 * screen, or taking turns in one place that stops on hover, on focus,
 * with its pause button and under reduced motion.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const LINES = ["Kargo bedava", "Aynı gün kargo", "30 gün iade"]
const settings = (over: Partial<AnnouncementSettings> = {}): AnnouncementSettings => ({
  ...ANNOUNCEMENT_DEFAULTS,
  ...over,
})
const frame = (over: Partial<AnnouncementSettings> | null) =>
  renderFrame(
    atolyeTheme,
    shopFixture({
      announcements: LINES,
      ...(over ? { announcementSettings: settings(over) } : {}),
    })
  )
const words = { announcements: "Duyurular", pause: "Duyuruları durdur", play: "Duyuruları oynat" }

describe("the announcement bar's lines as the server prints them", () => {
  it("shows the first alone by default, and from a storefront without the settings", () => {
    for (const html of [frame(null), frame({})]) {
      expect(html).toContain("Kargo bedava")
      expect(html).not.toContain("Aynı gün kargo")
    }
  })

  it("draws the main colour's ground and the pill button only when the shop sets them", () => {
    const plain = frame({})
    expect(plain).not.toContain("data-bar=")
    expect(plain).not.toContain("gf-bar-btn")
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        announcements: LINES,
        announcementSettings: settings({ tone: "primary" }),
        announcementLink: { path: "/magaza", label: "Teklif al" },
      })
    )
    expect(html).toMatch(/<div data-bar="primary" class="gf-stage/)
    expect(html).toMatch(/<a href="\/magaza" class="gf-bar-btn">Teklif al<svg/)
  })

  it("stands them side by side on a wide screen, a phone keeping the first", () => {
    const html = frame({ mode: "inline" })
    expect(html).toMatch(/<ul aria-label="Duyurular"/)
    expect(html).toContain("30 gün iade")
    expect(html.match(/<li class="[^"]*max-lg:hidden/g)).toHaveLength(2)
  })

  it("stacks the turning lines in one cell, the first shown and the others hidden", () => {
    const html = frame({ mode: "rotate" })
    expect(html).toContain('data-announcement-turns=""')
    expect(html.match(/\[grid-area:1\/1\]/g)).toHaveLength(3)
    expect(html).toMatch(/<li data-active=""[^>]*>Kargo bedava<\/li>/)
    expect(html).toMatch(/<li aria-hidden="true"[^>]*>Aynı gün kargo<\/li>/)
    expect(html).toContain('aria-label="Duyuruları durdur"')
  })
})

describe("the announcement bar's turning", () => {
  let host: HTMLDivElement
  let root: Root
  let reduced = false

  beforeEach(() => {
    vi.useFakeTimers()
    reduced = false
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: reduced,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
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

  const draw = (over: Partial<AnnouncementSettings> = {}) => {
    act(() => {
      root.render(<AnnouncementTurns lines={LINES} settings={settings(over)} words={words} />)
    })
  }
  const shown = () => host.querySelector("[data-active]")?.textContent
  const wait = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it("moves to the next line every interval and loops, speaking up only while held", () => {
    draw({ interval: "fast" })
    expect(shown()).toBe("Kargo bedava")
    expect(host.querySelector("ul")?.getAttribute("aria-live")).toBe("off")
    wait(ANNOUNCEMENT_INTERVAL.fast)
    expect(shown()).toBe("Aynı gün kargo")
    wait(ANNOUNCEMENT_INTERVAL.fast * 2)
    expect(shown()).toBe("Kargo bedava")
  })

  it("stops with its pause button and goes on when pressed again", () => {
    draw()
    const button = host.querySelector("button")
    act(() => {
      button?.click()
    })
    expect(button?.getAttribute("aria-label")).toBe("Duyuruları oynat")
    expect(host.querySelector("ul")?.getAttribute("aria-live")).toBe("polite")
    wait(ANNOUNCEMENT_INTERVAL.medium * 2)
    expect(shown()).toBe("Kargo bedava")
    act(() => {
      button?.click()
    })
    wait(ANNOUNCEMENT_INTERVAL.medium)
    expect(shown()).toBe("Aynı gün kargo")
  })

  it("stops under the pointer only when the shop wants it", () => {
    draw()
    const bar = host.querySelector("[data-announcement-turns]")
    act(() => {
      bar?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
    })
    wait(ANNOUNCEMENT_INTERVAL.medium)
    expect(shown()).toBe("Kargo bedava")

    draw({ hover_pause: "off" })
    wait(ANNOUNCEMENT_INTERVAL.medium)
    expect(shown()).toBe("Aynı gün kargo")
  })

  it("keeps the first line still under reduced motion", () => {
    reduced = true
    draw()
    wait(ANNOUNCEMENT_INTERVAL.slow * 3)
    expect(shown()).toBe("Kargo bedava")
  })

  it("hides a hover-only pause button until the pointer or focus comes", () => {
    draw({ pause_button: "hover" })
    const button = host.querySelector("button")
    expect(button?.className).toContain("[@media(hover:hover)]:opacity-0")
    act(() => {
      button?.focus()
    })
    expect(button?.className).not.toContain("opacity-0")
  })
})
