import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { HeroSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SHOP_NAME_TOKEN, slidesOf, withSlides } from "./catalog-slides"
import { HeroForm } from "./hero-form"
import type { CatalogHero } from "./slider-kit"
import { turnsAsSlider } from "./slider-kit"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const catalog = (more: Partial<CatalogHero> = {}): CatalogHero => ({
  ...(switchVariant(
    newHomeSection("hero", "giris00001") as HeroSection,
    "category_list"
  ) as CatalogHero),
  heading: "Bıçaklar",
  ...more,
})
const slide = { image: null, heading: "Kamp", text: null, links: [], link: null }

function hold(section: CatalogHero) {
  const changes: HeroSection[] = []
  function Holder() {
    const [value, setValue] = useState<HeroSection>(section)
    return (
      <HeroForm
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

/** adr/0049 Ek 2026-11-15: the catalogue opening's slides in the theme editor. */
describe("the catalogue opening's slides", () => {
  it("shows an opening saved before slides as its one slide, its own fields unread elsewhere", () => {
    hold(catalog())

    const list = screen.getByRole("list", { name: "Slaytlar" })
    expect(list.querySelectorAll("li")).toHaveLength(1)
    expect(screen.getByText("Bıçaklar")).toBeInTheDocument()
    // The heading, line, buttons and picture are the slide's: no second set beside it
    expect(document.getElementById("giris00001-heading")).toBeNull()
    expect(screen.queryByRole("button", { name: /1\. slaytı kaldır/i })).toBeNull()
  })

  it("moves slides, keeping the common fields the first one's", async () => {
    const changes = hold(catalog({ slides: [slidesOf(catalog())[0] ?? slide, slide] }))

    const [, up] = screen.getAllByRole("button", { name: /yukarı/i })
    if (!up) {
      throw new Error("no second row")
    }
    await userEvent.click(up)
    const moved = changes.at(-1) as CatalogHero
    expect(moved.slides?.map((each) => each.heading)).toEqual(["Kamp", "Bıçaklar"])
    expect(moved.heading).toBe("Kamp")
  })

  it("reads a missing heading as the shop's name token, turns only from two slides", () => {
    const old = catalog({ heading: null })

    expect(slidesOf(old)[0]?.heading).toBe(SHOP_NAME_TOKEN)
    expect(turnsAsSlider(withSlides(old, [slide]))).toBe(false)
    expect(turnsAsSlider(withSlides(old, [slide, slide]))).toBe(true)
    expect(turnsAsSlider(old)).toBe(false)
  })

  it("finds a slide with neither picture nor words before the save", () => {
    const empty = { ...slide, heading: null }
    expect(sectionProblems(withSlides(catalog(), [slide, empty]))).toMatchObject({
      "slides.1.image": "required",
    })
  })
})
