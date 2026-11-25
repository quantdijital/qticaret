import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FilterBar } from "./filter-bar"
import type { FilterDef, FilterValue, FilterValues } from "./filter-bar"

const FILTERS: FilterDef[] = [
  {
    key: "payment",
    label: "Ödeme",
    kind: "single",
    options: [
      { value: "paid", label: "Ödendi" },
      { value: "refunded", label: "İade edildi" },
    ],
  },
  {
    key: "shipping",
    label: "Kargo",
    kind: "multi",
    options: [
      { value: "label", label: "Etiket alındı" },
      { value: "on_the_way", label: "Yolda" },
      { value: "delivered", label: "Teslim edildi" },
    ],
  },
  {
    key: "waiting",
    label: "Bekleyen gün",
    kind: "number",
    min: 1,
    format: (days) => `${String(days)} günden fazla`,
  },
  { key: "days", label: "Tarih", kind: "days" },
]

function Bar({
  initial = {},
  onChange,
}: {
  initial?: FilterValues
  onChange?: (key: string, value: FilterValue) => void
}) {
  const [values, setValues] = useState<FilterValues>(initial)
  return (
    <FilterBar
      filters={FILTERS}
      values={values}
      onChange={(key, value) => {
        onChange?.(key, value)
        setValues((now) => ({ ...now, [key]: value }))
      }}
      onClear={() => {
        setValues({})
      }}
      search={<input aria-label="Ara" />}
      actions={<button type="button">Dışa aktar</button>}
    />
  )
}

const filterButton = () => screen.getByRole("button", { name: /^Filtrele( · \d+)?$/ })

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * A list's filter bar (docs/18 §7): one button opens a menu of filters,
 * each with its choices; what is set shows as chips under the row.
 */
describe("FilterBar", () => {
  it("shows the search, the button and the actions in one row, no chips while nothing is set", () => {
    render(<Bar />)
    expect(screen.getByRole("textbox", { name: "Ara" })).toBeInTheDocument()
    expect(filterButton()).toHaveTextContent("Filtrele")
    expect(screen.getByRole("button", { name: "Dışa aktar" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tümünü temizle" })).toBeNull()
  })

  it("opens the list of filters, then a filter's choices; one choice closes the menu", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Bar onChange={onChange} />)
    await user.click(filterButton())
    const menu = await screen.findByRole("dialog")
    for (const name of ["Ödeme", "Kargo", "Bekleyen gün", "Tarih"]) {
      expect(within(menu).getByRole("button", { name: new RegExp(name) })).toBeInTheDocument()
    }
    await user.click(within(menu).getByRole("button", { name: /Ödeme/ }))
    await user.click(screen.getByRole("button", { name: "Ödendi" }))
    expect(onChange).toHaveBeenCalledWith("payment", "paid")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(filterButton()).toHaveTextContent("Filtrele · 1")
    expect(screen.getByRole("button", { name: "Ödeme: Ödendi" })).toBeInTheDocument()
  })

  it("ticks several choices of a multiple filter and keeps the menu open", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Bar onChange={onChange} />)
    await user.click(filterButton())
    await user.click(await screen.findByRole("button", { name: /Kargo/ }))
    await user.click(screen.getByRole("checkbox", { name: "Yolda" }))
    await user.click(screen.getByRole("checkbox", { name: "Etiket alındı" }))
    // In the options' order, whichever was ticked first
    expect(onChange).toHaveBeenLastCalledWith("shipping", ["label", "on_the_way"])
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Yolda" }))
    expect(onChange).toHaveBeenLastCalledWith("shipping", ["label"])
    await user.click(screen.getByRole("checkbox", { name: "Etiket alındı" }))
    expect(onChange).toHaveBeenLastCalledWith("shipping", undefined)
  })

  it("takes a number typed in the menu", async () => {
    const user = userEvent.setup()
    render(<Bar />)
    await user.click(filterButton())
    await user.click(await screen.findByRole("button", { name: /Bekleyen gün/ }))
    const apply = screen.getByRole("button", { name: "Uygula" })
    expect(apply).toBeDisabled()
    await user.type(screen.getByRole("spinbutton", { name: "Bekleyen gün" }), "3")
    await user.click(apply)
    expect(screen.getByRole("button", { name: "Bekleyen gün: 3 günden fazla" })).toBeInTheDocument()
  })

  it("counts the set filters, and a chip reopens its own filter", async () => {
    const user = userEvent.setup()
    render(<Bar initial={{ payment: "refunded", shipping: ["label", "delivered"] }} />)
    expect(filterButton()).toHaveTextContent("Filtrele · 2")
    await user.click(screen.getByRole("button", { name: "Kargo: Etiket alındı, Teslim edildi" }))
    const menu = await screen.findByRole("dialog")
    expect(within(menu).getByRole("checkbox", { name: "Teslim edildi" })).toBeChecked()
    expect(within(menu).getByRole("checkbox", { name: "Yolda" })).not.toBeChecked()
  })

  it("clears one filter with its chip's ×, and every one with Tümünü temizle", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Bar initial={{ payment: "paid", days: { from: "2026-11-01" } }} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Ödeme filtresini kaldır" }))
    expect(onChange).toHaveBeenCalledWith("payment", undefined)
    expect(screen.queryByRole("button", { name: "Ödeme: Ödendi" })).toBeNull()
    expect(filterButton()).toHaveTextContent("Filtrele · 1")
    await user.click(screen.getByRole("button", { name: "Tümünü temizle" }))
    expect(filterButton()).toHaveTextContent(/^Filtrele$/)
    expect(screen.queryByRole("button", { name: "Tümünü temizle" })).toBeNull()
  })

  it("clears a filter from inside its choices", async () => {
    const user = userEvent.setup()
    render(<Bar initial={{ payment: "paid" }} />)
    await user.click(screen.getByRole("button", { name: "Ödeme: Ödendi" }))
    await user.click(await screen.findByRole("button", { name: "Temizle" }))
    expect(filterButton()).toHaveTextContent(/^Filtrele$/)
  })

  it("closes the menu with its own button", async () => {
    const user = userEvent.setup()
    render(<Bar />)
    await user.click(filterButton())
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.click(filterButton())
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("goes back from a filter's choices to the list", async () => {
    const user = userEvent.setup()
    render(<Bar />)
    await user.click(filterButton())
    await user.click(await screen.findByRole("button", { name: /Ödeme/ }))
    await user.click(screen.getByRole("button", { name: "Filtrelere dön" }))
    expect(screen.getByRole("button", { name: /Tarih/ })).toBeInTheDocument()
  })

  it("opens from the bottom edge on a phone or a touch screen", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    )
    const user = userEvent.setup()
    render(<Bar />)
    await user.click(filterButton())
    const sheet = await screen.findByRole("dialog", { name: "Filtrele" })
    expect(sheet).toHaveAttribute("data-slot", "sheet-content")
    expect(within(sheet).getByRole("button", { name: /Ödeme/ })).toBeInTheDocument()
  })
})
