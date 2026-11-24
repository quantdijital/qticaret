import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, SearchBoxSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, PAGE_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { i18next } from "@/lib/i18n"
import { sectionLabel } from "../section-meta"
import { contentFields } from "./content-registry"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const BOX = "aramakutu1"

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

/** adr/0077 §1: the shop's one search box as a section, its fields the theme's. */
describe("the search box section", () => {
  it("is offered on the home page and the content pages, nothing to write in a new one", () => {
    expect(HOME_TYPES).toContain("search_box")
    expect(PAGE_TYPES).toContain("search_box")
    const box = newHomeSection("search_box", BOX) as SearchBoxSection
    expect(box).toMatchObject({ type: "search_box", title: null, intro: null })
    expect(sectionProblems(box)).toEqual({})
  })

  it("writes the title and the intro, and says where the box's fields are chosen", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("search_box", BOX))

    expect(screen.getByText(/Alanları Tema › Arama kutusu/)).toBeInTheDocument()
    await user.type(screen.getByLabelText("Giriş"), "Nereye gitmek istersiniz?")
    expect(changes.at(-1)).toMatchObject({ intro: "Nereye gitmek istersiniz?" })
  })

  it("marks an intro over its length or with an unknown detail", () => {
    const box = newHomeSection("search_box", BOX) as SearchBoxSection
    expect(sectionProblems({ ...box, intro: "a".repeat(241) })).toEqual({ intro: "tooLong" })
    expect(sectionProblems({ ...box, intro: "{bilinmeyen}" })).toEqual({ intro: "tokenUnknown" })
  })

  it("is named by its title, has no settings of its own and leads a marked intro to its field", () => {
    const box = { ...newHomeSection("search_box", BOX), title: "Tur ara" } as SearchBoxSection
    expect(sectionLabel(i18next.t, box)).toEqual({ name: "Tur ara", detail: "Arama kutusu" })
    expect(contentFields(box)).toEqual([])
    expect(previewField(box, "title")?.target).toBe(`${BOX}-title`)
    expect(previewField(box, "intro")?.target).toBe(`${BOX}-intro`)
  })
})
