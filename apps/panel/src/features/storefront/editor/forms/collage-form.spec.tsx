import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SCROLLER_DEFAULTS } from "@qticaret/types"
import "@/lib/i18n"
import type {
  AnySection,
  PhotoCollageSection,
  ReviewsSection,
} from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, PAGE_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { openGroup, openTab } from "../settings-groups.fixtures"
import { contentFields } from "./content-registry"
import { FIELD_IDS } from "./field-registry"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const COLLAGE = "kolaj00001"
const REVIEWS = "yorumlar01"

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

const field = (id: string, name: string) => {
  const found = document.getElementById(FIELD_IDS.content(id, name as "collage_layout"))
  if (!found) throw new Error(`no ${name} field`)
  return within(found)
}

const photo = (n: number) => ({
  image: { url: `https://cdn.example.com/k-${String(n)}.jpg`, alt: `Görünüm ${String(n)}` },
  caption: null,
  link: null,
})

/** adr/0077 §10: the photo collage, a general section on the home and content pages. */
describe("the photo collage in the chooser", () => {
  it("is offered on the home page and the content pages, five photographs to choose", () => {
    expect(HOME_TYPES).toContain("photo_collage")
    expect(PAGE_TYPES).toContain("photo_collage")
    const collage = newHomeSection("photo_collage", COLLAGE) as PhotoCollageSection

    expect(collage).toMatchObject({
      title: null,
      intro: null,
      layout: "asymmetric",
      phone: "scroll",
    })
    expect(collage.items).toHaveLength(5)
    // Nothing chosen yet: the draft waits for each picture, then for its words
    expect(sectionProblems(collage)).toMatchObject({ "items.0.image": "imageRequired" })
    const unnamed = {
      ...collage,
      items: [
        photo(1),
        photo(2),
        { ...photo(3), image: { url: "https://cdn.example.com/k.jpg", alt: "" } },
      ],
    }
    expect(sectionProblems(unnamed)).toEqual({ "items.2.image": "required" })
  })
})

describe("the photo collage's panel", () => {
  it("offers its layout and the phone's in Diziliş, each set and reset", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("photo_collage", COLLAGE))
    await openGroup(user, "Diziliş")

    expect(
      field(COLLAGE, "collage_layout").getByRole("radio", { name: "Asimetrik" })
    ).toHaveAttribute("data-state", "on")
    await user.click(field(COLLAGE, "collage_layout").getByRole("radio", { name: "Eşit ızgara" }))
    expect(changes.at(-1)).toMatchObject({ layout: "even" })
    await user.click(field(COLLAGE, "collage_phone").getByRole("radio", { name: "Alt alta" }))
    expect(changes.at(-1)).toMatchObject({ layout: "even", phone: "stack" })
    await user.click(
      field(COLLAGE, "collage_phone").getByRole("button", { name: /Varsayılana dön/ })
    )
    expect(changes.at(-1)).toMatchObject({ phone: "scroll" })
  })

  it("writes the intro and a caption, adds up to seven and keeps three at least", async () => {
    const user = userEvent.setup()
    const changes = renderPanel({
      ...(newHomeSection("photo_collage", COLLAGE) as PhotoCollageSection),
      items: [photo(1), photo(2), photo(3)],
    })

    await user.type(screen.getByLabelText("Giriş"), "Atölyeden kareler.")
    await user.type(screen.getByLabelText(/^Fotoğraf 1 yazısı/), "Tezgâh")
    expect(changes.at(-1)).toMatchObject({
      intro: "Atölyeden kareler.",
      items: [{ caption: "Tezgâh", image: photo(1).image }, {}, {}],
    })
    for (const number of [1, 2, 3]) {
      expect(
        screen.getByRole("button", { name: `Fotoğraf ${String(number)}: kaldır` })
      ).toBeDisabled()
    }
    const add = screen.getByRole("button", { name: /Fotoğraf ekle/ })
    await user.click(add)
    await user.click(add)
    await user.click(add)
    await user.click(add)
    expect((changes.at(-1) as PhotoCollageSection).items).toHaveLength(7)
    expect(add).toBeDisabled()
  })
})

describe("the reviews' carousel (adr/0077 §10)", () => {
  const grid = () => newHomeSection("reviews", REVIEWS) as ReviewsSection

  it("starts as today's grid with no scrolling settings", () => {
    expect(grid()).toMatchObject({ variant: "grid", limit: 6 })
    expect(contentFields(grid()).map((each) => each.key)).toEqual(["limit"])
  })

  it("offers the carousel in Biçim, its scroller then in Kaydırma", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(grid())
    expect(screen.queryByRole("button", { name: /^Kaydırma/ })).toBeNull()

    await openTab(user, "style")
    const variant = document.getElementById(FIELD_IDS.variant(REVIEWS))
    if (!variant) throw new Error("no variant field")
    expect(
      within(variant)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Izgara", "Kaydırıcı"])
    await user.click(within(variant).getByRole("radio", { name: "Kaydırıcı" }))
    expect(changes.at(-1)).toMatchObject({ variant: "carousel", scroller: SCROLLER_DEFAULTS })
    expect(screen.getByRole("button", { name: /^Kaydırma/ })).toBeInTheDocument()
    const carousel = changes.at(-1) as ReviewsSection
    expect(contentFields(carousel).map((each) => [each.key, each.group])).toContainEqual([
      "scroller.desktop",
      "scroll",
    ])
  })
})

describe("the collage's settings search and preview marks", () => {
  it("finds its two settings in Diziliş and leads a caption or the intro to its field", () => {
    const collage = newHomeSection("photo_collage", COLLAGE)

    expect(contentFields(collage).map((each) => [each.key, each.group])).toEqual([
      ["collage_layout", "layout"],
      ["collage_phone", "layout"],
    ])
    expect(previewField(collage, "items.1.caption")?.target).toBe(`${COLLAGE}-items-1-caption`)
    expect(previewField(collage, "intro")?.target).toBe(`${COLLAGE}-intro`)
    expect(previewField(collage, "title")?.target).toBe(`${COLLAGE}-title`)
    expect(previewField(collage, "items.9.caption")).toBeNull()
  })
})
