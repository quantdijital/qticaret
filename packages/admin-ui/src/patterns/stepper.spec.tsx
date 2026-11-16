import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Stepper } from "./stepper"

const STEPS = [
  { key: "name", title: "Mağazanıza bir ad verin", done: false },
  { key: "currency", title: "Para birimini belirleyin", done: true },
  { key: "country", title: "Satış yapacağınız ülkeyi ekleyin", done: true },
]

describe("Stepper", () => {
  it("marks the current step and names a done one as done", () => {
    render(<Stepper steps={STEPS} currentKey="name" />)

    expect(screen.getByRole("button", { name: "Mağazanıza bir ad verin" })).toHaveAttribute(
      "aria-current",
      "step"
    )
    expect(
      screen.getByRole("button", { name: /^Para birimini belirleyin \(/ })
    ).not.toHaveAttribute("aria-current")
  })

  it("tells which step was picked", async () => {
    const onSelect = vi.fn()
    render(<Stepper steps={STEPS} currentKey="name" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole("button", { name: /^Satış yapacağınız/ }))
    expect(onSelect).toHaveBeenCalledWith("country")
  })

  // Beside the sidebar at 768px the card is narrower than the steps' words: a row
  // decided by the screen's width alone pushed the page sideways there
  it("goes into a row by its own box's width, and a step may shrink", () => {
    render(<Stepper steps={STEPS} currentKey="name" />)

    const list = screen.getByRole("list")
    expect(list.parentElement).toHaveClass("@container")
    const rowClasses = [list, ...screen.getAllByRole("listitem")].flatMap((element) =>
      element.className.split(/\s+/).filter((name) => name.startsWith("md:"))
    )
    expect(rowClasses.length).toBeGreaterThan(0)
    for (const name of rowClasses) {
      expect(name).toMatch(/^md:@min-\[34rem\]:/)
    }
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass("min-w-0")
    }
  })
})
