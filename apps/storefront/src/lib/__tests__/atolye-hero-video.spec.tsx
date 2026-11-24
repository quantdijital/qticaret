// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type { HeroFullView, HeroVideoView, HomeSectionView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"
import { HeroVideo } from "../../../../../packages/themes/atolye/src/sections/HeroVideo"
import { heroVideoWords } from "../../../../../packages/themes/atolye/src/sections/hero-video-words"

/**
 * The full image opening's video button in Atölye: none without a video
 * (the opening drawn as before), a quiet button with one, and nothing of
 * the player's in the page before the press; then a labelled dialog with
 * the player's address built from the id alone, closed by Escape with the
 * focus back on the button.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const YT = "dQw4w9WgXcQ"
const youtube: HeroVideoView = { host: "youtube", id: YT, label: null }
const vimeo: HeroVideoView = { host: "vimeo", id: "76979871", label: "Tanıtım filmi" }

const full = (video: HeroVideoView | null): HeroFullView => ({
  settings: HERO_FULL_DEFAULTS,
  accent: null,
  search: null,
  trust: [],
  video,
})

const cover = (view: HeroFullView, actions = true): HomeSectionView => ({
  id: "kapak",
  type: "hero",
  eyebrow: null,
  heading: "Doğayı keşfet.",
  intro: null,
  actions: actions ? [{ label: "Hemen keşfet", path: "/magaza" }] : [],
  image: null,
  variant: "full_image",
  full: view,
})

const home = (section: HomeSectionView) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [section] } })

describe("the opening's video button, as the server draws it", () => {
  it("draws no button and no frame without a video, the buttons' row as before", () => {
    const html = home(cover(full(null)))

    expect(html).not.toContain("Videoyu izle")
    expect(html).not.toMatch(/<iframe|data-video|youtube|vimeo/)
    expect(html).toContain(
      '<div class="flex flex-wrap gap-3 pt-1 justify-center"><a href="/magaza"'
    )
  })

  it("draws no row at all with neither buttons nor a video", () => {
    expect(home(cover(full(null), false))).not.toContain("flex flex-wrap gap-3 pt-1")
  })

  it("draws the button after the shop's buttons, and nothing of the player's", () => {
    const html = home(cover(full(youtube)))

    expect(html).toMatch(/Hemen keşfet<\/a><button[^>]*class="gf-btn gf-btn--quiet"/)
    expect(html).toContain("<span>Videoyu izle</span>")
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toMatch(/<iframe|youtube|nocookie/)
  })

  it("draws it alone in the row without the shop's buttons, under the shop's own words", () => {
    const html = home(cover(full(vimeo), false))

    expect(html).toMatch(/pt-1 justify-center"><button[^>]*class="gf-btn gf-btn--quiet"/)
    expect(html).toContain("<span>Tanıtım filmi</span>")
    expect(html).not.toMatch(/<iframe|player\.vimeo/)
  })

  it("draws no button for an id its player would not take", () => {
    const html = home(cover(full({ host: "youtube", id: `${YT}"><b>`, label: null })))

    expect(html).not.toContain("Videoyu izle")
    expect(html).not.toContain("<b>")
  })
})

describe("the opening's video lightbox", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  async function draw(video: HeroVideoView) {
    await act(async () => {
      root.render(<HeroVideo video={video} words={heroVideoWords(t)} />)
      await new Promise((done) => setTimeout(done, 20))
    })
    return host.querySelector("button")
  }

  async function press(element: Element | null) {
    await act(async () => {
      ;(element as HTMLElement | null)?.click()
      await new Promise((done) => setTimeout(done, 20))
    })
  }

  it("frames nothing before the press, then YouTube's privacy-enhanced player in a dialog", async () => {
    const button = await draw(youtube)
    expect(document.querySelector("iframe")).toBeNull()

    await press(button)

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy()
    expect(dialog?.textContent).toContain("YouTube videosu")
    const frames = document.querySelectorAll("iframe")
    expect(frames).toHaveLength(1)
    expect(frames[0]?.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&playsinline=1&rel=0`
    )
    expect(frames[0]?.getAttribute("title")).toBe("YouTube videosu")
    // The focus is held in the dialog, on its close button
    expect(dialog?.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Videoyu kapat")
  })

  it("frames Vimeo's player without tracking", async () => {
    await press(await draw(vimeo))

    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://player.vimeo.com/video/76979871?autoplay=1&dnt=1"
    )
  })

  it("closes on Escape, the frame gone and the focus back on the button", async () => {
    const button = await draw(youtube)
    await press(button)
    expect(document.querySelector("iframe")).not.toBeNull()

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
      await new Promise((done) => setTimeout(done, 20))
    })

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector("iframe")).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it("closes with its button too", async () => {
    const button = await draw(youtube)
    await press(button)

    await press(document.querySelector('[aria-label="Videoyu kapat"]'))

    expect(document.querySelector("iframe")).toBeNull()
    expect(document.activeElement).toBe(button)
  })
})
