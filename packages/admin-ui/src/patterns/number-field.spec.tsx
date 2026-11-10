import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import type { Control } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import { NumberField } from "./number-field"
import type { NumberFieldProps } from "./number-field"
import { stepText } from "../lib/number-step"

function Controlled({ start = "", ...props }: Partial<NumberFieldProps> & { start?: string }) {
  const [value, setValue] = useState(start)
  return (
    <>
      <label htmlFor="count">Adet</label>
      <NumberField
        id="count"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
        }}
        {...props}
      />
    </>
  )
}

function Hours({ control }: { control: Control<{ hours: string }> }) {
  return <output>{useWatch({ control, name: "hours" })}</output>
}

const field = () => screen.getByLabelText("Adet")
const plus = () => screen.getByRole("button", { name: "Artır" })
const minus = () => screen.getByRole("button", { name: "Azalt" })

describe("NumberField", () => {
  it("takes what is typed, found by its label", async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.type(field(), "1.250")
    expect(field()).toHaveValue("1.250")
    expect(field()).toHaveAttribute("role", "spinbutton")
    expect(field()).toHaveAttribute("inputmode", "numeric")
    expect(field()).toHaveAttribute("aria-valuenow", "1250")
  })

  it("steps with the up / down chevrons and the arrow keys, held between min and max", async () => {
    const user = userEvent.setup()
    render(<Controlled start="1" min={0} max={3} />)
    await user.click(plus())
    await user.click(plus())
    expect(field()).toHaveValue("3")
    expect(plus()).toBeDisabled()
    await user.click(field())
    await user.keyboard("{ArrowUp}")
    expect(field()).toHaveValue("3")
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}")
    expect(field()).toHaveValue("0")
    expect(minus()).toBeDisabled()
    expect(plus()).toBeEnabled()
  })

  it("moves by its step and keeps Turkish decimals", async () => {
    const user = userEvent.setup()
    render(<Controlled start="12,50" decimals={2} step={5} suffix="₺" />)
    expect(field()).toHaveAttribute("inputmode", "decimal")
    await user.click(plus())
    expect(field()).toHaveValue("17,50")
    expect(field()).toHaveAttribute("aria-valuetext", "17,50 ₺")
    expect(screen.getByText("₺")).toBeInTheDocument()
  })

  it("keeps the chevrons out of the tab order and the caret in the field", async () => {
    const user = userEvent.setup()
    render(<Controlled start="2" />)
    await user.click(field())
    await user.click(plus())
    expect(plus()).toHaveAttribute("tabindex", "-1")
    expect(field()).toHaveFocus()
    expect(field()).toHaveValue("3")
  })

  it("does nothing while disabled or read only, the chevrons never shown", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Controlled start="2" disabled />)
    expect(plus()).toBeDisabled()
    expect(minus()).toBeDisabled()
    expect(plus().parentElement).toHaveClass("invisible")
    rerender(<Controlled start="2" readOnly />)
    expect(plus()).toBeDisabled()
    expect(plus().parentElement).toHaveClass("invisible")
    await user.click(field())
    await user.keyboard("{ArrowUp}")
    expect(field()).toHaveValue("2")
  })

  it("is the browser's number input when plain, its spinner hidden", async () => {
    const user = userEvent.setup()
    const seen = vi.fn()
    render(
      <>
        <label htmlFor="units">Adet</label>
        <NumberField
          id="units"
          plain
          min={0}
          max={5}
          defaultValue={2}
          onChange={(event) => {
            seen(event.target.value)
          }}
        />
      </>
    )
    expect(field()).toHaveAttribute("type", "number")
    expect(field()).toHaveValue(2)
    expect(field().className).toContain("[&::-webkit-inner-spin-button]:appearance-none")
    await user.click(plus())
    expect(field()).toHaveValue(3)
    expect(seen).toHaveBeenLastCalledWith("3")
  })

  it("stacks the chevrons in the right edge, shown on hover or focus, left out on touch", () => {
    render(<Controlled start="1" />)
    const steps = plus().parentElement
    expect(steps).toHaveAttribute("data-slot", "number-field-steps")
    expect(steps?.firstElementChild).toBe(plus())
    expect(steps?.lastElementChild).toBe(minus())
    expect(steps).toHaveClass(
      "opacity-0",
      "group-hover/number:opacity-100",
      "group-focus-within/number:opacity-100",
      "pointer-coarse:hidden"
    )
    expect(field().closest("[data-slot=number-field]")?.lastElementChild).toBe(steps)
  })

  it("repeats while a chevron is held and stops at the limit or on release", () => {
    vi.useFakeTimers()
    try {
      render(<Controlled start="0" max={50} />)
      fireEvent.pointerDown(plus(), { button: 0 })
      expect(field()).toHaveValue("1")
      act(() => {
        vi.advanceTimersByTime(399)
      })
      expect(field()).toHaveValue("1")
      act(() => {
        vi.advanceTimersByTime(600)
      })
      const held = Number((field() as HTMLInputElement).value)
      expect(held).toBeGreaterThan(5)
      fireEvent.pointerUp(window)
      fireEvent.click(plus())
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(field()).toHaveValue(String(held))
      fireEvent.pointerDown(plus(), { button: 0 })
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(field()).toHaveValue("50")
      expect(plus()).toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("steps once on a click without a press (a screen reader's)", () => {
    render(<Controlled start="4" />)
    fireEvent.click(plus())
    expect(field()).toHaveValue("5")
    fireEvent.click(minus())
    fireEvent.click(minus())
    expect(field()).toHaveValue("3")
  })

  it("is 36 px, or 32 px and right aligned when compact", () => {
    const { rerender } = render(<Controlled start="1" />)
    const box = () => field().closest("[data-slot=number-field]")
    expect(box()).toHaveClass("h-9")
    rerender(<Controlled start="1" size="compact" className="w-24" />)
    expect(box()).toHaveClass("h-8", "w-24")
    expect(field()).toHaveClass("text-right")
  })

  it("works with a form's register, reset included", async () => {
    const user = userEvent.setup()
    function Form() {
      const form = useForm({ defaultValues: { hours: "24" } })
      return (
        <>
          <label htmlFor="hours">Adet</label>
          <NumberField id="hours" min={1} {...form.register("hours")} />
          <Hours control={form.control} />
          <button
            type="button"
            onClick={() => {
              form.reset({ hours: "1" })
            }}
          >
            Sıfırla
          </button>
        </>
      )
    }
    render(<Form />)
    expect(field()).toHaveValue("24")
    await user.click(plus())
    expect(screen.getByRole("status")).toHaveTextContent("25")
    await user.click(screen.getByRole("button", { name: "Sıfırla" }))
    expect(screen.getByRole("status")).toHaveTextContent("1")
    expect(field()).toHaveValue("1")
    expect(minus()).toBeDisabled()
  })
})

describe("stepText", () => {
  const rule = { plain: false, decimals: 0, step: 1 }

  it("starts an empty field from zero or its minimum", () => {
    expect(stepText("", 1, rule)).toBe("1")
    expect(stepText("", -1, { ...rule, min: 0 })).toBe("0")
    expect(stepText("", 1, { ...rule, min: 5 })).toBe("5")
  })

  it("keeps grouping, decimals and a minus as typed", () => {
    expect(stepText("1.250", 1, rule)).toBe("1.251")
    expect(stepText("1.250,50", 1, { ...rule, decimals: 2 })).toBe("1.251,50")
    expect(stepText("0,1", 1, { ...rule, decimals: 2, step: 0.1 })).toBe("0,2")
    expect(stepText("-2", 1, rule)).toBe("-1")
    expect(stepText("12.5", 1, { ...rule, plain: true })).toBe("13.5")
  })
})
