import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, FeaturedProductSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { FIELD_IDS } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const ID = "yakin00001"

/** The featured product's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={{}}
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

const field = () => {
  const found = document.getElementById(FIELD_IDS.content(ID, "gallery"))
  if (!found) throw new Error("no photographs layout field")
  return within(found)
}

/** adr/0049 Ek 2026-11-15: how the featured product's photographs stand. */
describe("the featured product's photographs layout", () => {
  it("shows open in Diziliş, the collage chosen for a section saved before it", () => {
    renderPanel(newHomeSection("featured_product", ID))

    expect(screen.getByRole("button", { name: "Diziliş" })).toHaveAttribute("aria-expanded", "true")
    expect(field().getByText("Fotoğraf düzeni")).toBeInTheDocument()
    expect(field().getByText("gallery")).toBeInTheDocument()
    expect(field().getByRole("radio", { name: "Kolaj" })).toBeChecked()
    expect(field().getByRole("radio", { name: "Çapraz şeritler" })).not.toBeChecked()
    expect(field().queryByRole("button", { name: "Varsayılana dön" })).toBeNull()
  })

  it("saves the strips, says what they do, and goes back to the collage", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("featured_product", ID))

    await user.click(field().getByRole("radio", { name: "Çapraz şeritler" }))
    expect(changes.at(-1)).toMatchObject({ type: "featured_product", gallery: "strips" })
    expect(field().getByText(/çapraz şeritler hâlinde yan yana/)).toBeInTheDocument()

    await user.click(field().getByRole("button", { name: "Varsayılana dön" }))
    expect(changes.at(-1)).toMatchObject({ gallery: "collage" })
  })

  it("reads a saved strips layout as chosen", () => {
    const section = newHomeSection("featured_product", ID) as FeaturedProductSection
    renderPanel({ ...section, gallery: "strips" })

    expect(field().getByRole("radio", { name: "Çapraz şeritler" })).toBeChecked()
  })
})

const fieldOf = (name: Parameters<typeof FIELD_IDS.content>[1]) => {
  const found = document.getElementById(FIELD_IDS.content(ID, name))
  if (!found) throw new Error(`no ${name} field`)
  return found
}
const strips = () => {
  const section = newHomeSection("featured_product", ID) as FeaturedProductSection
  return { ...section, gallery: "strips" as const }
}

/** adr/0049 Ek 2026-11-16: the strips' own look, under the photographs layout. */
describe("the featured product's strips look", () => {
  it("hides it with the collage", () => {
    renderPanel(newHomeSection("featured_product", ID))

    expect(document.getElementById(FIELD_IDS.content(ID, "strips_slant"))).toBeNull()
    expect(screen.queryByText("Eğim")).toBeNull()
  })

  it("shows the bolder defaults for strips saved before it", () => {
    renderPanel(strips())

    const slant = within(fieldOf("strips_slant"))
    expect(slant.getByText("strips_slant")).toBeInTheDocument()
    expect(slant.getByRole("radio", { name: "Orta" })).toBeChecked()
    expect(
      within(fieldOf("strips_layout")).getByRole("radio", { name: "Yazının yanında" })
    ).toBeChecked()
    expect(within(fieldOf("strips_line")).getByRole("radio", { name: "İnce" })).toBeChecked()
    expect(fieldOf("strips_overlap")).toHaveAttribute("aria-checked", "false")
    expect(fieldOf("strips_dim")).toHaveAttribute("aria-checked", "true")
    expect(screen.getByLabelText(/Üst üste bindir/)).toBe(fieldOf("strips_overlap"))
  })

  it("saves each step and switch, the wide layout saying how it stands", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(strips())

    await user.click(within(fieldOf("strips_layout")).getByRole("radio", { name: "Boydan boya" }))
    expect(changes.at(-1)).toMatchObject({ gallery: "strips", strips_layout: "wide" })
    expect(screen.getByText(/bütün genişliğini kaplar/)).toBeInTheDocument()

    await user.click(within(fieldOf("strips_slant")).getByRole("radio", { name: "Keskin" }))
    await user.click(within(fieldOf("strips_line")).getByRole("radio", { name: "Yok" }))
    await user.click(fieldOf("strips_overlap"))
    await user.click(fieldOf("strips_dim"))
    expect(changes.at(-1)).toMatchObject({
      strips_layout: "wide",
      strips_slant: "steep",
      strips_line: "none",
      strips_overlap: "on",
      strips_dim: "off",
    })

    await user.click(
      within(fieldOf("strips_slant")).getByRole("button", { name: "Varsayılana dön" })
    )
    expect(changes.at(-1)).toMatchObject({ strips_slant: "medium" })
  })
})
