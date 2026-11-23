import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, StatsSection, StepsSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, PAGE_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { lookStepsFor } from "@/features/storefront/layout/look"
import { SectionPanel } from "../section-panel"
import { openGroup } from "../settings-groups.fixtures"
import { contentFields } from "./content-registry"
import { FIELD_IDS } from "./field-registry"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const STATS = "rakamlar01"
const STEPS = "adimlar001"

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
  const found = document.getElementById(FIELD_IDS.content(id, name as "numbers"))
  if (!found) throw new Error(`no ${name} field`)
  return within(found)
}

/** adr/0077 §10: two general sections, offered on the home page and every content page. */
describe("the figures strip and the steps in the chooser", () => {
  it("are offered on the home page and the content pages, three to write in each", () => {
    expect(HOME_TYPES).toEqual(expect.arrayContaining(["stats", "steps"]))
    expect(PAGE_TYPES).toEqual(expect.arrayContaining(["stats", "steps"]))
    const strip = newHomeSection("stats", STATS) as StatsSection
    const steps = newHomeSection("steps", STEPS) as StepsSection

    expect(strip).toMatchObject({ title: null, dividers: "on" })
    expect(strip.items).toHaveLength(3)
    expect(steps).toMatchObject({ intro: null, link: null, layout: "row", numbers: "padded" })
    expect(steps.items).toHaveLength(3)
    // Nothing written yet: the draft waits for each figure's value and label, each step's title
    expect(sectionProblems(strip)).toMatchObject({
      "items.0.value": "required",
      "items.0.label": "required",
    })
    expect(sectionProblems(steps)).toMatchObject({ "items.2.title": "required" })
    expect(sectionProblems(steps)).not.toHaveProperty("title")
  })

  it("keeps the steps off the shop's colour (their lines are body text), the strip on it", () => {
    expect(lookStepsFor("steps", "ground")).not.toContain("primary")
    expect(lookStepsFor("stats", "ground")).toContain("primary")
  })
})

describe("the figures strip's panel", () => {
  it("writes the figures, adds up to six and keeps two at least", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("stats", STATS))

    await user.type(screen.getByLabelText(/^Değer 1/), "20 yıl")
    await user.type(screen.getByLabelText(/^Etiket 1/), "Tecrübe")
    expect(changes.at(-1)).toMatchObject({ items: [{ value: "20 yıl", label: "Tecrübe" }, {}, {}] })

    const add = screen.getByRole("button", { name: /Rakam ekle/ })
    await user.click(add)
    await user.click(add)
    await user.click(add)
    expect((changes.at(-1) as StatsSection).items).toHaveLength(6)
    expect(add).toBeDisabled()
  })

  it("offers its hairlines as a switch in Diziliş, on by default", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("stats", STATS))
    await openGroup(user, "Diziliş")

    const dividers = screen.getByRole("switch", { name: /Ayırıcı çizgileri göster/ })
    expect(dividers).toBeChecked()
    await user.click(dividers)
    expect(changes.at(-1)).toMatchObject({ dividers: "off" })
  })
})

describe("the steps' panel", () => {
  it("offers how they stand and are numbered in Diziliş, each set and reset", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("steps", STEPS))
    await openGroup(user, "Diziliş")

    expect(field(STEPS, "steps_layout").getByRole("radio", { name: "Yan yana" })).toHaveAttribute(
      "data-state",
      "on"
    )
    expect(field(STEPS, "numbers").getByRole("radio", { name: "01, 02" })).toHaveAttribute(
      "data-state",
      "on"
    )
    await user.click(field(STEPS, "steps_layout").getByRole("radio", { name: "Alt alta" }))
    expect(changes.at(-1)).toMatchObject({ layout: "column" })
    await user.click(field(STEPS, "numbers").getByRole("radio", { name: "1, 2" }))
    expect(changes.at(-1)).toMatchObject({ layout: "column", numbers: "plain" })
    await user.click(field(STEPS, "numbers").getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ numbers: "padded" })
  })

  it("writes the title, the intro and a step, the title's placeholder the storefront's", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(newHomeSection("steps", STEPS))

    expect(screen.getByPlaceholderText("Nasıl işler?")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Giriş"), "Üç adımda hazır.")
    await user.type(screen.getByLabelText(/^Adım 1 başlığı/), "Seçin")
    expect(changes.at(-1)).toMatchObject({
      intro: "Üç adımda hazır.",
      items: [{ title: "Seçin", text: null }, {}, {}],
    })
    // Three is the least: no step may be removed
    for (const number of [1, 2, 3]) {
      expect(screen.getByRole("button", { name: `Adım ${String(number)}: kaldır` })).toBeDisabled()
    }
  })
})

describe("the settings search and the preview's marks", () => {
  it("finds the strip's switch and the steps' two settings in Diziliş", () => {
    const strip = newHomeSection("stats", STATS)
    const steps = newHomeSection("steps", STEPS)

    expect(contentFields(strip).map((each) => [each.key, each.group])).toEqual([
      ["dividers", "layout"],
      ["show_icons", "layout"],
    ])
    expect(contentFields(steps).map((each) => [each.key, each.group])).toEqual([
      ["steps_layout", "layout"],
      ["numbers", "layout"],
    ])
  })

  it("leads a marked figure, step, intro or link to its field", () => {
    const strip = newHomeSection("stats", STATS)
    const steps = newHomeSection("steps", STEPS)

    expect(previewField(strip, "items.1.label")?.target).toBe(`${STATS}-items-1-label`)
    expect(previewField(strip, "title")?.target).toBe(`${STATS}-title`)
    expect(previewField(steps, "items.2.text")?.target).toBe(`${STEPS}-items-2-text`)
    expect(previewField(steps, "intro")?.target).toBe(`${STEPS}-intro`)
    expect(previewField(steps, "link")?.target).toBe(`${STEPS}-link`)
    expect(previewField(steps, "items.9.title")).toBeNull()
  })
})
