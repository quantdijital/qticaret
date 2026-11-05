import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { pastedLines, sameSummary, summaryOf } from "@/features/products/summary-lines"
import { SummaryField } from "./summary-field"

function Harness({ initial }: { initial: string[] }) {
  const [rows, setRows] = useState(initial)
  return (
    <>
      <SummaryField value={rows} onChange={setRows} />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </>
  )
}

const rowsNow = () => JSON.parse(screen.getByTestId("rows").textContent) as string[]
const line = (n: number) => screen.getByRole("textbox", { name: `${String(n)}. madde` })

describe("SummaryField", () => {
  it("opens on one empty row with the first example, counted as none", () => {
    render(<Harness initial={[]} />)
    expect(line(1)).toHaveValue("")
    expect(line(1)).toHaveAttribute("placeholder", "Örn. Malzeme ve ölçü bilgisi")
    expect(line(1)).toHaveAttribute("maxLength", "90")
    expect(screen.getByText("0/5")).toBeInTheDocument()
    // No arrows for a single row; nothing to remove yet
    expect(screen.queryByRole("button", { name: /yukarı taşı/ })).toBeNull()
    expect(screen.getByRole("button", { name: "1. maddeyi kaldır" })).toBeDisabled()
  })

  it("starts the next line on Enter and removes an empty one on Backspace", async () => {
    render(<Harness initial={[]} />)
    await userEvent.type(line(1), "Geyik boynuzu sap{Enter}")
    expect(line(2)).toHaveFocus()
    await userEvent.type(line(2), "Sırttan kilitli")
    expect(screen.getByText("2/5")).toBeInTheDocument()

    await userEvent.clear(line(2))
    await userEvent.keyboard("{Backspace}")
    expect(rowsNow()).toEqual(["Geyik boynuzu sap"])
    expect(line(1)).toHaveFocus()
  })

  it("moves and removes lines", async () => {
    render(<Harness initial={["A", "B", "C"]} />)
    await userEvent.click(screen.getByRole("button", { name: "3. maddeyi yukarı taşı" }))
    expect(rowsNow()).toEqual(["A", "C", "B"])
    expect(screen.getByRole("button", { name: "1. maddeyi yukarı taşı" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "3. maddeyi aşağı taşı" })).toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: "1. maddeyi aşağı taşı" }))
    expect(rowsNow()).toEqual(["C", "A", "B"])
    await userEvent.click(screen.getByRole("button", { name: "2. maddeyi kaldır" }))
    expect(rowsNow()).toEqual(["C", "B"])
  })

  it("adds lines up to five", async () => {
    render(<Harness initial={["A", "B", "C", "D"]} />)
    const add = screen.getByRole("button", { name: "Madde ekle" })
    await userEvent.click(add)
    expect(rowsNow()).toEqual(["A", "B", "C", "D", ""])
    expect(line(5)).toHaveFocus()
    expect(add).toBeDisabled()
    await userEvent.type(line(5), "E{Enter}")
    expect(rowsNow()).toEqual(["A", "B", "C", "D", "E"])
  })

  it("fills one line each from text pasted as several, up to five", async () => {
    render(<Harness initial={["Elde dövme"]} />)
    await userEvent.click(line(1))
    await userEvent.paste(
      "• Toplam boy: 21 cm\n\n- Namlu: 9 cm\nKabza: 12 cm\n1. Kilit: sırttan\nGaranti: 2 yıl"
    )
    // The typed line stays first; four of the five pasted fit
    expect(rowsNow()).toEqual([
      "Elde dövme",
      "Toplam boy: 21 cm",
      "Namlu: 9 cm",
      "Kabza: 12 cm",
      "Kilit: sırttan",
    ])
    expect(line(5)).toHaveFocus()
  })

  it("shows a line's characters close to the limit", async () => {
    render(<Harness initial={["x".repeat(69)]} />)
    expect(screen.queryByText("70/90")).toBeNull()
    await userEvent.type(line(1), "y")
    expect(screen.getByText("70/90")).toBeInTheDocument()
  })
})

describe("summary lines", () => {
  it("keeps the lines with text, tidied", () => {
    expect(summaryOf(["  N690   çelik ", "", " ​ ", "Sap\tahşap"])).toEqual([
      "N690 çelik",
      "Sap ahşap",
    ])
    expect(sameSummary(["A", ""], ["A "])).toBe(true)
    expect(sameSummary(["A", "B"], ["B", "A"])).toBe(false)
  })

  it("reads a pasted list without its markers, each line cut to 90", () => {
    expect(pastedLines(`✓ Bir\r\n* İki\n2) Üç\n2 yıl garanti\n${"z".repeat(95)}`)).toEqual([
      "Bir",
      "İki",
      "Üç",
      "2 yıl garanti",
      "z".repeat(90),
    ])
  })
})
