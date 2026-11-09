import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeroSlideView, HomeSectionView, ImageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"
import {
  isPlaying,
  wrapIndex,
} from "../../../../../packages/themes/atolye/src/sections/slider-play"

/**
 * The home page's sliding opening (adr/0049 Ek 2026-11-06): an extra to
 * the still hero, an accessible carousel that never moves by itself
 * unless the shop turned autoplay on.
 */

const picture = (name: string, avif = false): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: {
    avif: avif ? `/media/${name}-800.avif 800w, /media/${name}-1600.avif 1600w` : null,
    webp: null,
  },
})

const slide = (name: string, over: Partial<HeroSlideView> = {}): HeroSlideView => ({
  image: picture(name),
  mobileImage: null,
  heading: `${name} başlığı`,
  text: `${name} satırı`,
  link: { label: "Ürünlere göz atın", path: "/magaza" },
  position: "left",
  tone: "light",
  ...over,
})

const slider = (over: Partial<Extract<HomeSectionView, { type: "hero_slider" }>> = {}) =>
  ({
    id: "kayan",
    type: "hero_slider",
    slides: [slide("bir"), slide("iki"), slide("uc")],
    height: "regular",
    autoplay: false,
    interval: 6,
    dots: true,
    arrows: true,
    ...over,
  }) satisfies HomeSectionView

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the Atölye hero slider", () => {
  it("is a named carousel of slides labelled n / total, the first heading the page's h1", () => {
    const html = home([slider()])
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-label="Öne çıkan seçkiler"')
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(3)
    expect(html).toContain('aria-label="1 / 3"')
    expect(html).toContain('aria-label="3 / 3"')
    expect(html).toMatch(/<h1 class="max-w-\[18ch\] text-hero [^>]*>bir başlığı<\/h1>/)
    expect(html).toMatch(/<h2[^>]*>iki başlığı<\/h2>/)
    // The slider holds the h1: no stand-in for a reader
    expect(html).not.toContain('<h1 class="sr-only">')
    expect(html).toContain('href="/magaza"')
  })

  it("is still by default: polite announcements, no pause control, nothing timed", () => {
    const html = home([slider()])
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain("Slaytları durdur")
    expect(
      isPlaying({ autoplay: false, count: 3, choice: null, hydrated: true, reducedMotion: false })
    ).toBe(false)
  })

  it("plays only when the shop turned it on, the script runs and motion is welcome", () => {
    const on = { autoplay: true, count: 3, choice: null, hydrated: true, reducedMotion: false }
    expect(isPlaying(on)).toBe(true)
    expect(isPlaying({ ...on, hydrated: false })).toBe(false)
    expect(isPlaying({ ...on, reducedMotion: true })).toBe(false)
    expect(isPlaying({ ...on, count: 1 })).toBe(false)
    // The visitor's word wins: a stop is for good, a play even under reduced motion
    expect(isPlaying({ ...on, choice: "stop" })).toBe(false)
    expect(isPlaying({ ...on, reducedMotion: true, choice: "play" })).toBe(true)
    expect([wrapIndex(3, 3), wrapIndex(-1, 3), wrapIndex(1, 3)]).toEqual([0, 2, 1])
  })

  it("loads the first picture at once with high priority, the others lazily", () => {
    const html = home([
      slider({ slides: [slide("bir", { image: picture("bir", true) }), slide("iki")] }),
    ])
    expect(html).toMatch(/src="\/media\/bir\.jpg"[^>]*loading="eager"[^>]*fetchPriority="high"/)
    expect(html).toMatch(/src="\/media\/iki\.jpg"[^>]*loading="lazy"/)
    expect(html).toContain('<source type="image/avif" srcSet="/media/bir-800.avif')
    expect(html).toContain('sizes="(min-width: 1440px) 1344px, 100vw"')
  })

  it("gives a phone its own picture under 640 px and a fixed frame per height", () => {
    const html = home([
      slider({
        height: "compact",
        slides: [slide("bir", { mobileImage: picture("bir-dar") }), slide("iki")],
      }),
    ])
    expect(html).toContain('<source media="(max-width: 39.99rem)" srcSet="/media/bir-dar.jpg"/>')
    expect(html).toContain("sm:aspect-[2/1] lg:aspect-[3/1]")
    expect(home([slider()])).toContain("sm:aspect-[16/9] lg:aspect-[12/5]")
  })

  it("sets dark words on a light veil and centres them where the shop said", () => {
    const html = home([
      slider({ slides: [slide("bir", { tone: "dark", position: "center" }), slide("iki")] }),
    ])
    expect(html).toContain("gf-slide--dark")
    expect(html).toContain("sm:bg-paper/70")
    expect(html).toContain("sm:items-center sm:text-center")
  })

  it("is not the page's h1 below another section, and a slide without words is a picture", () => {
    const html = home([
      {
        id: "guven",
        type: "trust_badges",
        badges: [{ icon: "truck", title: "Kargo", text: "Hızlı" }],
      },
      slider({ slides: [slide("bir", { heading: null, text: null, link: null }), slide("iki")] }),
    ])
    expect(html).toContain('<h1 class="sr-only">Ana sayfa</h1>')
    expect(html).not.toMatch(/<h1[^>]*>bir/)
    // A slide without a link: the rail takes the focus so its keys scroll it
    expect(html).toMatch(
      /role="group" tabindex="0" aria-label="Öne çıkan seçkiler"|tabindex="0"[^>]*role="group"/
    )
  })

  it("leaves the still hero as it was beside it", () => {
    const html = home([
      slider(),
      {
        id: "giris",
        type: "hero",
        eyebrow: null,
        heading: "Atölye",
        intro: null,
        actions: [],
        image: null,
      },
    ])
    expect(html).toContain(">Atölye</h2>")
  })
})
