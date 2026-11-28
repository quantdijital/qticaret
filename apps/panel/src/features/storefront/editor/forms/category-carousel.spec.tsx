import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SCROLLER_DEFAULTS } from "@qticaret/types"
import "@/lib/i18n"
import type { AnySection, CategoriesSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { openGroup, openTab } from "../settings-groups.fixtures"
import { contentFields } from "./content-registry"
import { FIELD_IDS } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const ID = "kayankat01"

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

const variantField = () => {
  const found = document.getElementById(FIELD_IDS.variant(ID))
  if (!found) throw new Error("no variant field")
  return within(found)
}

describe("the categories' sliding cards", () => {
  const tiles = () => newHomeSection("categories", ID) as CategoriesSection

  it("offers the sliding cards last in Biçim, its scroller then in Kaydırma", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(tiles())
    expect(screen.queryByRole("button", { name: /^Kaydırma/ })).toBeNull()

    await openTab(user, "style")
    expect(
      variantField()
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
        .at(-1)
    ).toBe("Kayan kartlar")
    await user.click(variantField().getByRole("radio", { name: "Kayan kartlar" }))
    expect(changes.at(-1)).toMatchObject({ variant: "carousel", scroller: SCROLLER_DEFAULTS })
    expect(screen.getByRole("button", { name: /^Kaydırma/ })).toBeInTheDocument()
    const carousel = changes.at(-1) as CategoriesSection
    expect(contentFields(carousel).map((each) => [each.key, each.group])).toEqual(
      expect.arrayContaining([
        ["show_count", "content"],
        ["scroller.desktop", "scroll"],
        ["scroller.autoplay", "look"],
      ])
    )
  })

  it("sets the cards in view in Kaydırma", async () => {
    const user = userEvent.setup()
    const carousel = { ...tiles(), variant: "carousel", scroller: SCROLLER_DEFAULTS } as const
    const changes = renderPanel(carousel)
    await openGroup(user, "Kaydırma")
    const desktop = document.getElementById(FIELD_IDS.scroller(ID, "desktop"))
    if (!desktop) throw new Error("no desktop field")
    const radios = within(desktop).getAllByRole("radio")
    const five = radios[2]
    if (!five) throw new Error("no third step")
    await user.click(five)
    expect(changes.at(-1)).toMatchObject({
      variant: "carousel",
      scroller: { ...SCROLLER_DEFAULTS, desktop: "five" },
    })
  })

  it("drops its scroller and a preset's handles back on the tiles", () => {
    const carousel: CategoriesSection = {
      ...tiles(),
      variant: "carousel",
      scroller: SCROLLER_DEFAULTS,
      category_handles: ["macera"],
    }
    const back = switchVariant(carousel, "tiles")
    expect(back).toMatchObject({ variant: "tiles" })
    expect(back).not.toHaveProperty("scroller")
    expect(back).not.toHaveProperty("category_handles")
  })
})
