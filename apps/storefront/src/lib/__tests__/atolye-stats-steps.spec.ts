import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView } from "@qticaret/ui"
import type { StoreStatsSection, StoreStepsSection } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { statsView, stepsView } from "@/lib/views/points"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0077 §10 as the storefront draws it: the figures strip as one
 * description list and the numbered steps as one ordered list, each in the
 * shop's words; nothing at all with nothing to show.
 */

const strip = (over: Partial<StoreStatsSection> = {}): StoreStatsSection => ({
  id: "rakamlar01",
  type: "stats",
  title: null,
  items: [
    { value: "20 yıl", label: "Tecrübe", text: null },
    { value: "10.000+", label: "Mutlu müşteri", text: "Her gün yenileri" },
    { value: "%98", label: "Zamanında teslim", text: null },
  ],
  ...over,
})

const howTo = (over: Partial<StoreStepsSection> = {}): StoreStepsSection => ({
  id: "adimlar01",
  type: "steps",
  title: null,
  intro: null,
  items: [
    { title: "Seçin", text: "Size uygun olanı bulun." },
    { title: "Sipariş verin", text: null },
    { title: "Teslim alın", text: "Kapınıza gelsin." },
  ],
  link: null,
  ...over,
})

const words = (html: string) => html.replaceAll("&#x27;", "'")
const home = (sections: HomeSectionView[]) =>
  words(renderPage(atolyeTheme, "HomePage", { view: { sections } }))

describe("the figures strip's and the steps' views", () => {
  it("keeps the figures, a list name for a screen reader, the default settings", () => {
    expect(statsView(strip(), t)).toMatchObject({
      type: "stats",
      title: null,
      label: "Rakamlarla",
      dividers: "on",
      items: [{ value: "20 yıl", label: "Tecrübe", text: null }, {}, {}],
    })
    // A step from a newer backend reads as the default
    expect(statsView(strip({ dividers: "dotted" as never }), t)?.dividers).toBe("on")
    expect(statsView(strip({ items: [] }), t)).toBeNull()
  })

  it("numbers the steps as the shop chose, the storefront's title while none", () => {
    expect(stepsView(howTo(), t)).toMatchObject({
      title: "Nasıl işler?",
      layout: "row",
      numbers: "padded",
      link: null,
      items: [{ number: "01", title: "Seçin" }, { number: "02" }, { number: "03" }],
    })
    const plain = stepsView(howTo({ title: "Nasıl sipariş verilir", numbers: "plain" }), t)
    expect(plain?.title).toBe("Nasıl sipariş verilir")
    expect(plain?.items.map((item) => item.number)).toEqual(["1", "2", "3"])
    expect(stepsView(howTo({ items: [] }), t)).toBeNull()
  })
})

describe("Atölye's figures strip and steps", () => {
  it("draws the figures as one description list, named while it has no heading", () => {
    const view = statsView(strip(), t)
    if (!view) {
      throw new Error("no strip")
    }
    const html = home([view])

    expect(html).toContain('aria-label="Rakamlarla"')
    expect(html).toMatch(/<dl[^>]*>/)
    expect(html).toMatch(/<dt[^>]*>Tecrübe<\/dt><dd[^>]*>20 yıl<\/dd>/)
    expect(html).toContain("Her gün yenileri")
    expect(html).toContain("lg:grid-cols-3")
    expect(html).toContain("border-rule")
    expect(html).not.toContain("style=")
  })

  it("heads the strip with the shop's title, no hairlines with dividers off", () => {
    const view = statsView(strip({ title: "Rakamlarla biz", dividers: "off" }), t)
    if (!view) {
      throw new Error("no strip")
    }
    const html = home([view])

    expect(html).toMatch(/aria-labelledby="[^"]+"/)
    expect(html).toContain(">Rakamlarla biz</h2>")
    expect(html).not.toContain("border-rule")
  })

  it("draws the steps as one ordered list, the numbers for the eye only, the link under them", () => {
    const view = stepsView(
      howTo({
        intro: "Üç adımda hazır.",
        link: { label: "Alışverişe başla", kind: "system", target: "shop", path: "/magaza" },
      }),
      t
    )
    if (!view) {
      throw new Error("no steps")
    }
    const html = home([view])

    expect(html).toContain(">Nasıl işler?</h2>")
    expect(html).toContain("Üç adımda hazır.")
    expect(html).toMatch(/<ol role="list"[^>]*>/)
    expect(html.match(/<li /g)).toHaveLength(3)
    expect(html).toContain('<span aria-hidden="true"')
    expect(html).toContain(">01</span>")
    expect(html).toContain("<h3")
    expect(html).toContain("Kapınıza gelsin.")
    expect(html).toContain('href="/magaza"')
    expect(html).toContain("Alışverişe başla")
    expect(html).not.toContain("style=")
  })

  it("stacks the steps one under another in the column layout", () => {
    const view = stepsView(howTo({ layout: "column", numbers: "plain" }), t)
    if (!view) {
      throw new Error("no steps")
    }
    const html = home([view])

    expect(html).toContain("max-w-3xl")
    expect(html).not.toContain("md:grid-cols-2")
    expect(html).toContain(">1</span>")
  })

  it("keeps the figures stacked without profiles by default, even with the shop's profiles at hand", () => {
    const profiles = [
      { label: "Instagram", href: "https://instagram.com/vadi", network: "instagram" as const },
    ]
    const view = statsView(strip(), t, profiles)
    if (!view) {
      throw new Error("no strip")
    }
    expect(view).toMatchObject({ arrangement: "stacked", social: "off" })
    expect(view.follow).toBeUndefined()
    const html = home([view])
    expect(html).toContain("lg:grid-cols-3")
    expect(html).not.toContain("Bizi izleyin")
  })

  it("sets the figures in one row with the shop's profiles at its end", () => {
    const profiles = [
      { label: "Instagram", href: "https://instagram.com/vadi", network: "instagram" as const },
    ]
    const view = statsView(strip({ arrangement: "row", social: "on" }), t, profiles)
    if (!view) {
      throw new Error("no strip")
    }
    expect(view.follow).toEqual({ title: "Bizi izleyin", profiles })
    // On, but no profile to show: no empty line
    expect(statsView(strip({ social: "on" }), t, [])?.follow).toBeUndefined()
    const html = home([view])
    expect(html).toContain("grid-cols-[auto_minmax(0,1fr)]")
    expect(html).not.toContain("lg:grid-cols-3")
    expect(html).toContain(">Bizi izleyin</p>")
    expect(html).toContain('href="https://instagram.com/vadi"')
    expect(html).toContain('aria-label="Instagram"')
    expect(html).toContain('rel="noopener noreferrer me"')
  })
})
