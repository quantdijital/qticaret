import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { ANNOUNCEMENT_DEFAULTS, ANNOUNCEMENT_SETTINGS } from "@qticaret/types/section-announcement"
import type { AnnouncementSettings } from "@qticaret/types"
import { renderFrame, shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { Announcement } from "../../../../../packages/themes/atolye/src/frame/Announcement"
import {
  ANNOUNCEMENT_ALIGN,
  ANNOUNCEMENT_SIZE,
} from "../../../../../packages/themes/atolye/src/frame/announcement-steps"

/**
 * Where the announcement bar's lines sit and how big it is in Atölye
 * (adr/0049 Ek 2026-11-15): the defaults draw the bar as it was, every
 * alignment and size works with every way of showing several lines, the
 * shop's links stay at the end and `center` balances them with an empty
 * start only while they show.
 */

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
const words = {
  announcements: "Duyurular",
  links: "Kurumsal bağlantılar",
  pause: "Duyuruları durdur",
  play: "Duyuruları oynat",
}
const shop = shopFixture()
/** The bar alone, as the frame draws it; without links it is as the catalog header's strip leaves it. */
const drawn = (over: Partial<AnnouncementSettings>, withLinks = true) =>
  renderToStaticMarkup(
    <Announcement
      lines={LINES}
      settings={settings(over)}
      links={withLinks ? shop.topLinks : []}
      contact={withLinks ? shop.contact : { ...shop.contact, phone: null, phoneHref: null }}
      words={words}
    />
  )
/** The bar's row: the container's classes. */
const row = (html: string) => /<div class="mx-auto w-full [^"]*"/.exec(html)?.[0] ?? ""
const navOf = (html: string) =>
  /<nav aria-label="Kurumsal bağlantılar" class="([^"]*)"/.exec(html)?.[1]
const classesOf = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}[^>]* class="([^"]*)"`, "g"))].map((match) => match[1])

describe("the announcement bar's defaults", () => {
  it("draw the bar as it was: centred on a phone, at the start wide, 36 px with small words", () => {
    for (const html of [frame(null), frame({}), frame({ align: "auto", size: "medium" })]) {
      expect(html).toContain('<div class="gf-stage text-sm">')
      expect(row(html)).toContain(
        "flex min-h-9 items-center justify-center gap-6 lg:justify-between"
      )
      expect(html).toContain(
        '<p aria-label="Duyurular" class="py-2 text-center font-semibold lg:text-left">'
      )
      expect(navOf(html)).toBe("ml-auto hidden items-center gap-1 lg:flex")
      expect(html).toContain(
        'class="inline-flex min-h-9 items-center rounded-button px-3 text-stage-text-2 pointer-coarse:min-h-11 no-underline hover:text-stage-text"'
      )
    }
  })
})

describe("the announcement bar's alignment", () => {
  it("sets the lines at the start, the middle or the end on every screen", () => {
    expect(row(drawn({ align: "left" }))).toMatch(/justify-start gap-6"$/)
    expect(drawn({ align: "left" })).toContain('class="py-2 text-left font-semibold"')
    expect(row(drawn({ align: "center" }))).toContain("justify-center gap-6")
    expect(drawn({ align: "center" })).toContain('class="py-2 text-center font-semibold"')
    expect(row(drawn({ align: "right" }))).toMatch(/justify-end gap-6"$/)
    expect(drawn({ align: "right" })).toContain('class="py-2 text-right font-semibold"')
    for (const align of ["left", "center", "right"] as const) {
      expect(row(drawn({ align }))).not.toContain("lg:justify-between")
    }
  })

  it("keeps the shop's links at the end: right after the lines, after an empty start in the middle", () => {
    expect(navOf(drawn({ align: "left" }))).toBe("ml-auto hidden items-center gap-1 lg:flex")
    expect(navOf(drawn({ align: "right" }))).toBe("hidden items-center gap-1 lg:flex")
    expect(navOf(drawn({ align: "center" }))).toBe(
      "hidden items-center gap-1 lg:flex lg:flex-1 lg:basis-0 lg:justify-end lg:whitespace-nowrap"
    )
    // The printed page escapes the empty content's quotes
    expect(row(drawn({ align: "center" }))).toContain(
      ANNOUNCEMENT_ALIGN.center.spacer.replaceAll("'", "&#x27;")
    )
  })

  it("centres the lines in the whole bar without the links, with no empty start", () => {
    const html = drawn({ align: "center" }, false)
    expect(html).not.toContain("<nav")
    expect(row(html)).not.toContain("before:")
    expect(row(html)).toContain("justify-center")
  })

  it("places the lines side by side and taking turns the same way", () => {
    for (const align of ANNOUNCEMENT_SETTINGS.align) {
      const steps = ANNOUNCEMENT_ALIGN[align]
      const inline = drawn({ mode: "inline", align })
      expect(classesOf(inline, "ul")[0]).toContain(steps.justify)
      if (steps.listWide) expect(classesOf(inline, "ul")[0]).toContain(steps.listWide)

      const turning = drawn({ mode: "rotate", align })
      expect(turning).toContain('data-announcement-turns=""')
      expect(turning).toContain('aria-label="Duyuruları durdur"')
      for (const li of classesOf(turning, "li")) {
        expect(li).toContain(steps.text)
        if (steps.textWide) expect(li).toContain(steps.textWide)
      }
    }
    // The wide screen's own start only for the default
    expect(classesOf(drawn({ mode: "inline", align: "right" }), "ul")[0]).not.toContain("lg:")
  })
})

describe("the announcement bar's size", () => {
  it("sets the bar's height and its words together, links tappable at 44 px on touch", () => {
    for (const size of ANNOUNCEMENT_SETTINGS.size) {
      const steps = ANNOUNCEMENT_SIZE[size]
      const html = drawn({ size })
      expect(html).toContain(`<div class="gf-stage ${steps.text}">`)
      expect(row(html)).toContain(`flex ${steps.height} items-center`)
      expect(html).toContain(`<p aria-label="Duyurular" class="${steps.pad} `)
      expect(html).toContain(`class="inline-flex ${steps.height} items-center rounded-button`)
      expect(html.match(/pointer-coarse:min-h-11/g)).toHaveLength(2)
    }
    expect(ANNOUNCEMENT_SIZE.small).toMatchObject({ text: "text-xs", height: "min-h-8" })
    expect(ANNOUNCEMENT_SIZE.large).toMatchObject({ text: "text-md", height: "min-h-11" })
  })

  it("sizes the turning lines and their pause button, 44 px on touch", () => {
    for (const size of ANNOUNCEMENT_SETTINGS.size) {
      const steps = ANNOUNCEMENT_SIZE[size]
      const html = drawn({ mode: "rotate", size, pause_button: "hover" })
      for (const li of classesOf(html, "li")) expect(li).toContain(steps.pad)
      const button = /<button[^>]* class="([^"]*)"/.exec(html)?.[1] ?? ""
      expect(button).toContain(`inline-flex ${steps.button} shrink-0`)
      expect(button).toContain("pointer-coarse:size-11")
      expect(button).toContain("[@media(hover:hover)]:opacity-0")
    }
  })
})
