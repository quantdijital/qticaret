import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { Hint, HintProvider } from "./hint"

describe("Hint: the editor's tooltip in place of the browser's title", () => {
  it("opens on keyboard focus, keeps the button's own name, and closes on Escape", async () => {
    const user = userEvent.setup()
    render(
      <HintProvider>
        <Hint label="Geri al">
          <button type="button" aria-label="Geri al">
            ↶
          </button>
        </Hint>
      </HintProvider>
    )
    const button = screen.getByRole("button", { name: "Geri al" })
    expect(button).not.toHaveAttribute("title")
    expect(screen.queryByRole("tooltip")).toBeNull()

    await user.tab()
    expect(button).toHaveFocus()
    const tip = await screen.findByRole("tooltip")
    expect(tip).toHaveTextContent("Geri al")
    // While open, the button points at the words
    expect(button).toHaveAccessibleDescription("Geri al")

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull()
    })
  })

  it("describes the element at all times when asked, for touch screens and readers", () => {
    render(
      <Hint label="Değişiklik taslağa yazılır" describe>
        <button type="button">Grafit'e dön</button>
      </Hint>
    )
    // No provider around it: the hint brings its own
    expect(screen.getByRole("button", { name: "Grafit'e dön" })).toHaveAccessibleDescription(
      "Değişiklik taslağa yazılır"
    )
  })

  it("lets a toggle that names its own state keep it on (the hint's would win otherwise)", () => {
    render(
      <ToggleGroup type="single" value="b">
        {["a", "b"].map((each) => (
          <Hint key={each} label={each}>
            <ToggleGroupItem value={each} data-state={each === "b" ? "on" : "off"}>
              {each}
            </ToggleGroupItem>
          </Hint>
        ))}
      </ToggleGroup>
    )
    expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute("data-state", "on")
    expect(screen.getByRole("radio", { name: "a" })).toHaveAttribute("data-state", "off")
  })

  it("still shows on a disabled button when wrapped, its description staying on the button", async () => {
    const user = userEvent.setup()
    render(
      <HintProvider>
        <Hint label="Geri al" describe wrap>
          <button type="button" aria-label="Geri al" disabled>
            ↶
          </button>
        </Hint>
      </HintProvider>
    )
    const button = screen.getByRole("button", { name: "Geri al" })
    // The span takes the pointer the disabled button lets through
    const span = button.parentElement
    if (span?.tagName !== "SPAN") {
      throw new Error("the hint did not wrap the button")
    }
    expect(button).toHaveAccessibleDescription("Geri al")
    expect(span).not.toHaveAttribute("aria-describedby")

    await user.hover(span)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Geri al")
  })

  it("leaves the element bare when there are no words", () => {
    render(
      <Hint label={null}>
        <button type="button">Aç</button>
      </Hint>
    )
    const button = screen.getByRole("button", { name: "Aç" })
    expect(button).not.toHaveAttribute("data-state")
    expect(button).not.toHaveAttribute("aria-describedby")
  })
})
