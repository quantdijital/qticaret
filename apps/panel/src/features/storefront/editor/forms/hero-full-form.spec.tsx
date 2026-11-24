import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { HERO_FULL_DEFAULTS, HERO_FULL_LIMITS, SECTION_VARIANTS } from "@qticaret/types"
import "@/lib/i18n"
import type { AnySection, HeroSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { VARIANT_FIELDS, switchVariant } from "@/features/storefront/layout/variants"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"
import { contentFields } from "./content-registry"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

type Full = Extract<HeroSection, { variant: "full_image" }>

const hero = () => newHomeSection("hero", "kapak00001") as HeroSection
const full = (over: Partial<Full> = {}): Full => ({
  ...(switchVariant(hero(), "full_image") as Full),
  ...over,
})

/** A section's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={sectionProblems(value)}
        canDuplicate
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
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

/** The opening's "Düğmeler" group, open or closed. */
const buttonsGroup = () => document.querySelector('[data-panel-group="buttons"]')

/** adr/0077 §9: the opening's third variant in the theme editor. */
describe("the full image opening's start", () => {
  it("is on the opening's list, named in both languages", () => {
    expect(SECTION_VARIANTS.hero).toContain("full_image")
    expect(tr.storefront.editor.variants.hero.full_image).toBe("Tam görsel")
    expect(en.storefront.editor.variants.hero.full_image).toBe("Full image")
  })

  it("starts from the contract's defaults and keeps the opening's words, buttons and picture", () => {
    expect(VARIANT_FIELDS.hero.full_image).toEqual({
      ...HERO_FULL_DEFAULTS,
      title_accent: null,
      show_trust: false,
      video_url: null,
      video_label: null,
    })
    const written = { ...hero(), heading: "Doğayı keşfet", image: { url: "/vadi.webp", alt: null } }
    const switched = switchVariant(written, "full_image")
    expect(switched).toMatchObject({
      variant: "full_image",
      heading: "Doğayı keşfet",
      image: { url: "/vadi.webp" },
      action: "button",
    })
    // Back to today's opening, its own fields are dropped
    const back = switchVariant(switched, "standard")
    expect(back).not.toHaveProperty("action")
    expect(back).not.toHaveProperty("title_accent")
    expect(back).toMatchObject({ variant: "standard", heading: "Doğayı keşfet" })
  })

  it("names every step in both languages", () => {
    for (const words of [tr, en]) {
      const own: Record<string, Record<string, string> | string> = words.storefront.editor.heroFull
      for (const [name, steps] of Object.entries({
        action: ["button", "search"],
        search_position: ["inside", "overlap"],
        height: ["screen", "tall"],
        scrim: ["light", "strong"],
        align: ["center", "start"],
        image_side: ["full", "end"],
        edge: ["straight", "wave"],
      })) {
        for (const key of ["label", "term", "hint", ...steps]) {
          expect(own[name], `${name}.${key}`).toHaveProperty(key)
        }
      }
    }
  })
})

describe("the full image opening's panel", () => {
  it("shows none of its fields on today's opening", () => {
    renderPanel(hero())

    expect(screen.queryByRole("textbox", { name: /Vurgulu satır/ })).toBeNull()
    expect(screen.queryByRole("radio", { name: "Arama kutusu" })).toBeNull()
    expect(screen.queryByRole("switch", { name: /Güven ikonlarını göster/ })).toBeNull()
  })

  it("takes the accent line under the heading", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(full())

    await user.type(screen.getByRole("textbox", { name: /Vurgulu satır/ }), "K")

    expect(changes.at(-1)).toMatchObject({ title_accent: "K" })
  })

  it("offers the buttons or the search box, the box's place only with the search", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(full())

    expect(screen.getByRole("radio", { name: "Düğmeler" })).toBeChecked()
    expect(screen.queryByRole("radio", { name: "Alt kenara taşan kart" })).toBeNull()
    expect(buttonsGroup()).not.toBeNull()

    await user.click(screen.getByRole("radio", { name: "Arama kutusu" }))

    expect(changes.at(-1)).toMatchObject({ action: "search" })
    expect(screen.getByRole("radio", { name: "Kapağın içinde" })).toBeChecked()
    expect(screen.getByText(/Tema ayarları › Arama kutusu/)).toBeInTheDocument()
    // The buttons stay saved, their group is not shown while the search stands
    expect(buttonsGroup()).toBeNull()

    await user.click(screen.getByRole("radio", { name: "Alt kenara taşan kart" }))
    expect(changes.at(-1)).toMatchObject({ action: "search", search_position: "overlap" })
  })

  it("turns the shop's trust badges on with a switch, off by default", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(full())

    const trust = screen.getByRole("switch", { name: /Güven ikonlarını göster/ })
    expect(trust).not.toBeChecked()
    await user.click(trust)

    expect(changes.at(-1)).toMatchObject({ show_trust: true })
  })

  it("offers its height, alignment, picture's place, veil and edge in Diziliş", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(full())
    await openGroup(user, "Diziliş")

    expect(screen.getByRole("radio", { name: "Tam ekran" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Ortada" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Yazının arkasında" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Hafif" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Düz" })).toBeChecked()

    await user.click(screen.getByRole("radio", { name: "Yüksek" }))
    expect(changes.at(-1)).toMatchObject({ height: "tall" })
    await user.click(screen.getByRole("radio", { name: "Dalgalı" }))
    expect(changes.at(-1)).toMatchObject({ height: "tall", edge: "wave" })

    // Beside the words there is no veil to choose
    await user.click(screen.getByRole("radio", { name: "Yazının yanında" }))
    expect(changes.at(-1)).toMatchObject({ image_side: "end" })
    expect(screen.queryByRole("radio", { name: "Güçlü" })).toBeNull()
  })

  it("refuses an accent line past its limit before the save", () => {
    const long = full({ title_accent: "a".repeat(HERO_FULL_LIMITS.title_accent + 1) })

    expect(sectionProblems(long)["title_accent"]).toBe("tooLong")
    expect(sectionProblems(full({ title_accent: "Kaçışını bul" }))["title_accent"]).toBeUndefined()
  })
})

describe("the full image opening in the settings search and the preview", () => {
  it("finds its fields as its form shows them, each in its group", () => {
    const keys = (section: AnySection) =>
      contentFields(section).map((each) => [each.key, each.group])

    expect(keys(full())).toEqual([
      ["action", "content"],
      ["show_trust", "content"],
      ["video_url", "video"],
      ["height", "layout"],
      ["align", "layout"],
      ["image_side", "layout"],
      ["scrim", "layout"],
      ["edge", "layout"],
    ])
    expect(keys(full({ action: "search", image_side: "end" }))).toEqual([
      ["action", "content"],
      ["search_position", "content"],
      ["show_trust", "content"],
      ["video_url", "video"],
      ["height", "layout"],
      ["align", "layout"],
      ["image_side", "layout"],
      ["edge", "layout"],
    ])
    expect(keys(hero())).toEqual([])
  })

  it("lands a click on the preview's accent line on its field", () => {
    expect(previewField(full(), "title_accent")).toMatchObject({
      target: "kapak00001-title_accent",
    })
    expect(previewField(hero(), "title_accent")).toBeNull()
  })
})
