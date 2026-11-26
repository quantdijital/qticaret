import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { FilterBar } from "./filter-bar"
import type { FilterValues } from "./filter-bar"
import { FilterTabs } from "./filter-tabs"

const TABS = [
  { key: "all", label: "Tümü", count: 12 },
  { key: "mutation", label: "Değişiklik" },
  { key: "system", label: "Sistem" },
] as const

/**
 * A list's quick views (docs/18 §7): an underlined tab row; a list without
 * a search puts its "Filtrele" button at the row's end (the owner,
 * 2026-11-26: the button stood alone on a row under the tabs).
 */
describe("FilterTabs", () => {
  it("marks the chosen tab and reports another", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterTabs label="Görünümler" tabs={[...TABS]} value="all" onChange={onChange} />)
    expect(screen.getByRole("tab", { name: /^Tümü\s*12$/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.click(screen.getByRole("tab", { name: "Sistem" }))
    expect(onChange).toHaveBeenCalledWith("system")
  })

  it("is the bare tab list without an end", () => {
    const { container } = render(
      <FilterTabs label="Görünümler" tabs={[...TABS]} value="all" onChange={vi.fn()} />
    )
    expect(container.firstElementChild).toHaveAttribute("role", "tablist")
  })

  it("puts the end's controls in the tabs' row, outside the tab list", () => {
    render(
      <FilterTabs
        label="Görünümler"
        tabs={[...TABS]}
        value="all"
        onChange={vi.fn()}
        end={<button type="button">Filtrele</button>}
      />
    )
    const list = screen.getByRole("tablist", { name: "Görünümler" })
    const button = screen.getByRole("button", { name: "Filtrele" })
    expect(within(list).queryByRole("button", { name: "Filtrele" })).toBeNull()
    expect(list.parentElement).toBe(button.closest("[data-filter-tabs-end]"))
  })
})

function Placed({ initial = {} }: { initial?: FilterValues }) {
  const [values, setValues] = useState<FilterValues>(initial)
  return (
    <FilterBar
      compact
      filters={[
        {
          key: "resource",
          label: "Kaynak",
          kind: "single",
          options: [{ value: "order", label: "Sipariş" }],
        },
      ]}
      values={values}
      onChange={(key, value) => {
        setValues((now) => ({ ...now, [key]: value }))
      }}
      onClear={() => {
        setValues({})
      }}
      layout={({ trigger, chips }) => (
        <>
          <FilterTabs
            label="Görünümler"
            tabs={[...TABS]}
            value="all"
            onChange={vi.fn()}
            end={trigger}
          />
          {chips ? <div data-testid="chips">{chips}</div> : null}
        </>
      )}
    />
  )
}

describe("FilterBar placed by the list", () => {
  it("puts the button at the tabs' end and the chips under them only while one is set", async () => {
    const user = userEvent.setup()
    render(<Placed />)
    const row = screen.getByRole("tablist").parentElement
    if (!row) {
      throw new Error("no row")
    }
    // The name stays whole for a screen reader while the phone shows the icon
    const button = within(row).getByRole("button", { name: "Filtrele" })
    expect(screen.queryByTestId("chips")).toBeNull()
    await user.click(button)
    await user.click(await screen.findByRole("button", { name: /Kaynak/ }))
    await user.click(screen.getByRole("button", { name: "Sipariş" }))
    expect(within(row).getByRole("button", { name: "Filtrele · 1" })).toBeInTheDocument()
    expect(
      within(screen.getByTestId("chips")).getByRole("button", { name: "Kaynak: Sipariş" })
    ).toBeInTheDocument()
  })
})
