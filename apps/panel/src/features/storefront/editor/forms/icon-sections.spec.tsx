import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { VARIANT_FIELDS } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"
import { iconsFor } from "./icon-registry"
import { contentFields } from "./content-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const CAT_A = "pcat_01KICONA"
const CAT_B = "pcat_01KICONB"

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

const card = (): AnySection =>
  ({ ...newHomeSection("trust_badges", "guvenkart01"), variant: "card", lift: "off" }) as AnySection

const iconRow = (): AnySection =>
  ({
    ...newHomeSection("categories", "ikonsira01"),
    ...VARIANT_FIELDS.categories.icons,
    variant: "icons",
    category_ids: [CAT_A, CAT_B],
  }) as AnySection

/** adr/0077 §10 Ek: the new variants start from today's look. */
describe("the icon variants' start", () => {
  it("starts the card unlifted and the icon row with no icon picked", () => {
    expect(VARIANT_FIELDS.trust_badges.card).toEqual({ lift: "off" })
    expect(VARIANT_FIELDS.categories.icons).toEqual({
      disc: "tint",
      phone: "scroll",
      row_style: "stacked",
      category_icons: {},
    })
  })

  it("starts a new figures strip without icons", () => {
    expect(newHomeSection("stats", "rakamlar01")).toMatchObject({ icons: "off" })
  })
})

describe("the trust card's panel", () => {
  it("offers the lift as a switch in Diziliş, off by default", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(card())
    await openGroup(user, "Diziliş")

    const lift = screen.getByRole("switch", { name: /Üstteki bölüme taşsın/ })
    expect(lift).not.toBeChecked()
    await user.click(lift)
    expect(changes.at(-1)).toMatchObject({ variant: "card", lift: "on" })
  })

  it("finds the lift in the settings search only on the card", () => {
    expect(contentFields(card()).map((each) => [each.key, each.group])).toEqual([
      ["lift", "layout"],
    ])
    expect(contentFields(newHomeSection("trust_badges", "guven02"))).toEqual([])
  })
})

describe("the figures strip's icons", () => {
  it("shows each figure's icon choice only while the switch is on", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("stats", "rakamlar01"))
    expect(screen.queryByRole("combobox", { name: "Rakam 1 ikonu" })).toBeNull()

    await openGroup(user, "Diziliş")
    await user.click(screen.getByRole("switch", { name: /İkon göster/ }))

    expect(changes.at(-1)).toMatchObject({ icons: "on" })
    await openGroup(user, "İçerik")
    expect(screen.getByRole("combobox", { name: "Rakam 1 ikonu" })).toBeInTheDocument()
  })
})

describe("the categories' icon row", () => {
  it("offers an icon beside each named category and its two steps in Diziliş", async () => {
    const user = userEvent.setup()
    renderPanel(iconRow())
    expect(screen.getAllByRole("combobox", { name: / ikonu$/ })).toHaveLength(2)

    await openGroup(user, "Diziliş")
    expect(screen.getByRole("radio", { name: "Ana rengin açık tonu" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Yana kaydır" })).toBeChecked()
  })

  it("keeps only the icons of the categories still named", () => {
    expect(iconsFor([CAT_A], { [CAT_A]: "mountain", [CAT_B]: "leaf" })).toEqual({
      [CAT_A]: "mountain",
    })
  })

  it("finds the disc and the phone row in the settings search", () => {
    expect(contentFields(iconRow()).map((each) => [each.key, each.group])).toEqual([
      ["show_count", "content"],
      ["disc", "layout"],
      ["icons_phone", "layout"],
      ["icons_row_style", "layout"],
    ])
  })
})
