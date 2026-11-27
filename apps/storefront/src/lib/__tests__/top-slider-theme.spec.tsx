// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { TOP_SLIDER_DEFAULTS } from "@qticaret/types/section-top-slider"
import type { TopSliderSettings } from "@qticaret/types"
import type { ImageView, TopSliderView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderFrame, shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { TopSlider } from "../../../../../packages/themes/atolye/src/frame/TopSlider"
import { topSliderWords } from "../../../../../packages/themes/atolye/src/frame/top-slider-words"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const picture = (name: string, alt: string): ImageView => ({
  src: `/static/${name}.webp`,
  alt,
  width: 1920,
  height: 120,
  sources: { avif: null, webp: null },
})
const view = (over: Partial<TopSliderSettings> = {}): TopSliderView => ({
  id: "kaydirici01",
  slides: [
    {
      image: picture("kis", "Kış indirimi"),
      mobileImage: null,
      link: { path: "/kampanyalar", label: "" },
    },
    {
      image: picture("yeni", "Yeni gelenler"),
      mobileImage: picture("yeni-m", "Yeni gelenler"),
      link: null,
    },
    { image: picture("kargo", "Kargo bedava"), mobileImage: null, link: null },
  ],
  settings: { ...TOP_SLIDER_DEFAULTS, ...over },
})

/** The top image slider (owner 2026-11-27) as the server prints it above the header. */
describe("the top image slider in the frame", () => {
  it("draws nothing without one, and its band above the text strip with one", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).not.toContain("data-top-slider")
    const html = renderFrame(atolyeTheme, shopFixture({ topSlider: view() }))
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-label="Kampanya görselleri"')
    // The band's room held from the first paint: the thin step
    expect(html).toMatch(/data-top-slider="" class="[^"]*h-10 lg:h-12/)
    expect(html.indexOf("data-top-slider")).toBeLessThan(html.indexOf("<header"))
    // The first picture asked for first, the others when needed
    expect(html).toMatch(/alt="Kış indirimi"[^>]*loading="eager"[^>]*fetchPriority="high"/i)
    expect(html).toMatch(/alt="Yeni gelenler"[^>]*loading="lazy"/)
    expect(html).toContain('<a href="/kampanyalar"')
    expect(html).toContain('media="(max-width: 39.99rem)"')
    expect(html).toContain('aria-label="Önceki görsel"')
    expect(html).not.toContain('aria-label="1. görsele geç"')
  })

  it("draws dots and no arrows when asked, and its taller bands", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({ topSlider: view({ arrows: "off", dots: "on", height: "tall" }) })
    )
    expect(html).not.toContain('aria-label="Önceki görsel"')
    expect(html).toContain('aria-label="2. görsele geç"')
    expect(html).toContain("lg:h-30")
  })
})

describe("the top image slider's turning", () => {
  let host: HTMLDivElement
  let root: Root
  let reduced = false
  beforeEach(() => {
    vi.useFakeTimers()
    reduced = false
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
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
  const draw = (over: Partial<TopSliderSettings> = {}) => {
    act(() => {
      root.render(<TopSlider view={view(over)} words={topSliderWords(t, 3)} />)
    })
  }
  const shown = () => host.querySelector("[data-active] img")?.getAttribute("alt")
  const wait = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }
  const press = (name: string) => {
    act(() => {
      host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)?.click()
    })
  }

  it("turns by itself, steps by its arrows and slides the way it went", () => {
    draw({ interval: "fast" })
    expect(shown()).toBe("Kış indirimi")
    wait(4000)
    expect(shown()).toBe("Yeni gelenler")
    press("Önceki görsel")
    expect(shown()).toBe("Kış indirimi")
    expect(host.querySelector("ul")?.hasAttribute("data-back")).toBe(true)
    expect(host.querySelector('[data-move="in"] img')?.getAttribute("alt")).toBe("Kış indirimi")
  })

  it("stands still under reduced motion, its arrows still stepping", () => {
    reduced = true
    draw()
    wait(20000)
    expect(shown()).toBe("Kış indirimi")
    press("Sonraki görsel")
    expect(shown()).toBe("Yeni gelenler")
  })

  it("stops with its pause button", () => {
    draw({ interval: "fast" })
    press("Görselleri durdur")
    wait(8000)
    expect(shown()).toBe("Kış indirimi")
    expect(host.querySelector("ul")?.getAttribute("aria-live")).toBe("polite")
  })
})
