import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoryIconsView, HomeSectionView, TrustBadgeView } from "@qticaret/ui"
import type { StoreStatsSection } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { statsView } from "@/lib/views/points"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0077 §10 Ek as Atolye draws it: the trust badges' floating card (and
 * its lift only with a section before it), the categories' icon row (icon,
 * else picture, else initial) and the figures' icons, each only when the
 * shop chose it; today's drawings unchanged.
 */

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const BADGES: TrustBadgeView[] = [
  { icon: "truck", title: "Hızlı kargo", text: "Aynı gün" },
  { icon: "shield", title: "Güvenli ödeme", text: null },
  { icon: "refresh", title: "Kolay iade", text: "14 gün" },
]

const badges = (over: Record<string, unknown> = {}): HomeSectionView => ({
  id: "guven01",
  type: "trust_badges",
  variant: "card",
  badges: BADGES,
  ...over,
})

const help: HomeSectionView = {
  id: "yardim01",
  type: "help",
  title: "Yardım",
  text: "Sorun",
  contact: { phone: null, email: null, whatsapp: null, hours: null },
} as unknown as HomeSectionView

const ICONS: CategoryIconsView = {
  disc: "tint",
  phone: "scroll",
  items: [
    { label: "Macera", path: "/macera", icon: "mountain", image: null, initial: "M" },
    {
      label: "Plaj",
      path: "/plaj",
      icon: null,
      image: {
        src: "/m/plaj.jpg",
        alt: "Plaj",
        width: 80,
        height: 80,
        sources: { avif: null, webp: null },
      },
      initial: "P",
    },
    { label: "Kültür", path: "/kultur", icon: null, image: null, initial: "K" },
  ],
}

const row = (view: CategoryIconsView): HomeSectionView => ({
  id: "ikonsira01",
  type: "categories",
  title: "Gezi türleri",
  categories: view.items.map(({ label, path }) => ({ label, path })),
  variant: "icons",
  icons: view,
})

describe("the trust badges' card", () => {
  it("draws the badges in one floating box, unlifted by default", () => {
    const html = home([badges()])
    expect(html).toContain('data-variant="card"')
    expect(html).toContain("shadow-float")
    expect(html).toContain("Hızlı kargo")
    expect(html).not.toContain("data-lift")
  })

  it("lifts the box over the section before it, never as the page's first block", () => {
    expect(home([help, badges({ lift: true })])).toContain("data-lift")
    expect(home([help, badges({ lift: true })])).toContain("-mt-(--promise-lift)")
    expect(home([badges({ lift: true })])).not.toContain("data-lift")
  })

  it("keeps today's strip and lined boxes as they were", () => {
    const strip = home([badges({ variant: "strip" })])
    expect(strip).not.toContain('data-variant="card"')
    expect(home([badges({ variant: "lined" })])).toContain('data-variant="lined"')
  })
})

describe("the categories' icon row", () => {
  it("draws an icon, else the picture on the photo well, else the initial", () => {
    const html = home([row(ICONS)])
    expect(html).toContain('data-variant="icons"')
    expect(html).toContain("lucide-mountain")
    expect(html).toContain("/m/plaj.jpg")
    expect(html).toContain("bg-media")
    expect(html).toMatch(/aria-hidden="true"[^>]*>K<\/span>/)
    expect(html).toContain('href="/kultur"')
    expect(html).toContain("gf-rail")
  })

  it("wraps on a phone when the shop chose it, on a ring when it chose the line", () => {
    const html = home([row({ ...ICONS, phone: "wrap", disc: "line" })])
    expect(html).not.toContain("gf-rail")
    expect(html).toContain("border-rule")
  })
})

describe("the figures' icons", () => {
  const strip = (over: Partial<StoreStatsSection> = {}): StoreStatsSection => ({
    id: "rakamlar01",
    type: "stats",
    title: null,
    items: [
      { value: "100+", label: "Rota", text: null, icon: "compass" },
      { value: "4.8", label: "Puan", text: null },
    ],
    ...over,
  })

  it("leaves the icons out until the shop turns them on", () => {
    const off = statsView(strip(), t)
    expect(off?.icons).toBe("off")
    expect(off?.items[0]).toEqual({ value: "100+", label: "Rota", text: null })
    expect(home(off ? [off] : [])).not.toContain("lucide-compass")
  })

  it("draws a picked icon over its value, for the eye only", () => {
    const on = statsView(strip({ icons: "on" }), t)
    expect(on?.items.map((item) => item.icon)).toEqual(["compass", null])
    const html = home(on ? [on] : [])
    expect(html).toContain("lucide-compass")
    expect(html).toMatch(/<dd aria-hidden="true"[^>]*><svg/)
  })
})
