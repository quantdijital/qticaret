import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type {
  AnySection,
  HeroSection,
  HeroSliderSection,
  LayoutLink,
} from "@/features/storefront/api/layout"
import { newAnnouncementBar, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { previewField } from "./preview-fields"
import type { CatalogHero } from "./slider-kit"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

/** The section's panel opened from an edit label in the preview, at the field it named. */
function openAt(section: AnySection, key: string, group: "header" | "home" = "home") {
  const field = previewField(section, key)
  if (!field) {
    throw new Error(`no field ${key}`)
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SectionPanel
        section={section}
        group={group}
        problems={{}}
        canDuplicate
        onChange={vi.fn()}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
        focus={{ ...field, nonce: 1 }}
      />
    </QueryClientProvider>
  )
  return field
}

const link: LayoutLink = { kind: "url", url: "https://a.example", label: "Tümü" }
const hero = (over: Partial<HeroSection> = {}) =>
  ({
    ...newHomeSection("hero", "giris00001"),
    heading: "Bıçaklar",
    links: [link],
    image: { url: "/static/a.webp", alt: "Atölye" },
    ...over,
  }) as HeroSection

/** adr/0065 §9, Faz 2b: the panel's side of a field's edit label. */
describe("a field named by the preview", () => {
  it("is scrolled to, focused and marked in the section's form", () => {
    const field = openAt(hero(), "heading")
    const element = document.getElementById(field.target)
    expect(element).not.toBeNull()
    expect(document.activeElement).toBe(element)
    expect(element?.hasAttribute("data-highlight")).toBe(true)
  })

  it("lands on a picture's control", () => {
    const image = openAt(hero(), "image")
    const box = document.getElementById(image.target)
    expect(box?.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.tagName).toBe("BUTTON")
  })

  it("lands on a button's words", () => {
    const button = openAt(hero(), "links.0")
    expect(document.activeElement?.id).toBe(button.target)
  })

  it("lands on an announcement's line", () => {
    const bar = { ...newAnnouncementBar("duyuru0001"), lines: ["Bir", "İki"] }
    openAt(bar, "lines.1", "header")
    expect(document.activeElement).toHaveValue("İki")
  })

  it("opens a sliding opening's slide in its dialog, at the field", async () => {
    const slider: HeroSliderSection = {
      ...(newHomeSection("hero_slider", "kayan00001") as HeroSliderSection),
      slides: [0, 1].map((at) => ({
        image: { url: `/static/${String(at)}.webp`, alt: null },
        mobile_image: null,
        heading: `Slayt ${String(at)}`,
        text: null,
        link: null,
        position: "left" as const,
        tone: "light" as const,
      })),
    }
    openAt(slider, "slides.1.heading")
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("hero-slide-1-heading")
    })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toHaveValue("Slayt 1")
  })

  it("opens a catalogue opening's slide at its picture's control", async () => {
    const catalog = switchVariant(hero(), "category_list") as CatalogHero
    const field = openAt(catalog, "image")
    expect(field.slide).toBe(0)
    await screen.findByRole("dialog")
    await waitFor(() => {
      expect(document.getElementById(field.target)?.contains(document.activeElement)).toBe(true)
    })
    expect(document.activeElement?.tagName).toBe("BUTTON")
  })
})
