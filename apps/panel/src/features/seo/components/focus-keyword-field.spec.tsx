import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { FocusKeywordField } from "./focus-keyword-field"

const changes = vi.fn()

// A landing page: no AI button, the chips alone
function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <FocusKeywordField
      type="landing"
      id="lp_1"
      value={value}
      onChange={(next) => {
        changes(next)
        setValue(next)
      }}
    />
  )
}

const input = () => document.getElementById("seo-keyword-lp_1") as HTMLInputElement
const removeButton = (keyword: string) =>
  screen.getByRole("button", { name: `“${keyword}” kelimesini kaldır` })
const last = () => changes.mock.calls.at(-1)?.[0] as string

/** The owner, 2026-11-25: focus keywords are added as tags with Enter, not as plain text. */
describe("FocusKeywordField", () => {
  it("shows a value from before the list as one chip", () => {
    render(<Harness initial="keten gömlek" />)
    expect(removeButton("keten gömlek")).toBeInTheDocument()
    expect(input()).toHaveValue("")
    // One keyword needs no "Ana" mark
    expect(screen.queryByText("Ana")).not.toBeInTheDocument()
  })

  it("adds a chip with Enter, a comma or leaving the field, and keeps the first as the primary", async () => {
    changes.mockClear()
    const user = userEvent.setup()
    render(<Harness initial="" />)

    await user.type(input(), "çelik termos{Enter}")
    expect(last()).toBe("çelik termos")
    await user.type(input(), "kamp termosu,")
    await user.type(input(), "termos 750 ml")
    await user.tab()
    expect(last()).toBe("çelik termos, kamp termosu, termos 750 ml")
    expect(screen.getByText("Ana")).toBeInTheDocument()
  })

  it("splits a pasted list and leaves out a repeat in Turkish case", async () => {
    changes.mockClear()
    const user = userEvent.setup()
    render(<Harness initial="ışık" />)

    await user.click(input())
    await user.paste("IŞIK, masa lambası , okuma lambası")
    expect(last()).toBe("ışık, masa lambası, okuma lambası")
    expect(input()).toHaveValue("")
  })

  it("takes the last chip back with Backspace and one by its ×", async () => {
    changes.mockClear()
    const user = userEvent.setup()
    render(<Harness initial="a, b, c" />)

    await user.click(input())
    await user.keyboard("{Backspace}")
    expect(last()).toBe("a, b")
    await user.click(removeButton("a"))
    expect(last()).toBe("b")
  })

  it("makes another keyword the primary by its text, by keyboard too", async () => {
    changes.mockClear()
    const user = userEvent.setup()
    render(<Harness initial="termos, çelik termos, kamp termosu" />)

    await user.click(screen.getByRole("button", { name: "“kamp termosu” ana kelime olsun" }))
    expect(last()).toBe("kamp termosu, termos, çelik termos")
    screen.getByRole("button", { name: "“termos” ana kelime olsun" }).focus()
    await user.keyboard("{Enter}")
    expect(last()).toBe("termos, kamp termosu, çelik termos")
  })

  it("stops at five keywords with a line that says so, never an error", async () => {
    changes.mockClear()
    const user = userEvent.setup()
    render(<Harness initial="a, b, c, d" />)

    await user.click(input())
    await user.paste("e, f")
    expect(last()).toBe("a, b, c, d, e")
    expect(screen.getByRole("status")).toHaveTextContent("En çok 5 odak kelime eklenir")
    expect(input()).not.toHaveAttribute("aria-invalid")
  })
})
