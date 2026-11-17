import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { FieldHints } from "../hooks/use-field-hints"
import { Field } from "./form-section"
import { HiddenHint, InfoTip } from "./info-tip"

const HINT = "Boş bırakırsanız mağazanızın adı görünür."

function Tip() {
  return (
    <>
      <InfoTip name="Başlık" hint={HINT} hintId="baslik-hint" />
      <HiddenHint id="baslik-hint">{HINT}</HiddenHint>
      <button type="button">Başka yer</button>
    </>
  )
}

const tip = () => screen.getByRole("button", { name: "Bilgi: Başlık" })
const shown = () => screen.queryByRole("tooltip")

/**
 * The (i) beside a field's name (docs/18 §7.1): its words open on hover,
 * on keyboard focus and on a tap, Escape closes them, and a screen reader
 * reads them from the button's description without opening anything.
 */
describe("InfoTip", () => {
  it("is named after its field and described by the hidden words", () => {
    render(<Tip />)
    expect(tip()).toHaveAccessibleDescription(HINT)
    expect(tip()).toHaveAttribute("data-info-tip")
    expect(shown()).toBeNull()
  })

  it("opens on hover", async () => {
    const user = userEvent.setup()
    render(<Tip />)
    await user.hover(tip())
    expect(await screen.findByRole("tooltip")).toHaveTextContent(HINT)
  })

  it("opens on keyboard focus and closes on Escape", async () => {
    const user = userEvent.setup()
    render(<Tip />)
    await user.tab()
    expect(tip()).toHaveFocus()
    expect(await screen.findByRole("tooltip")).toHaveTextContent(HINT)
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(shown()).toBeNull()
    })
  })

  it("opens and closes on a tap: a touch screen has no hover", async () => {
    const user = userEvent.setup()
    render(<Tip />)
    // The focus a tap gives after the finger lifts does not open it ahead of the tap's click
    await user.pointer({ keys: "[TouchA]", target: tip() })
    expect(await screen.findByRole("tooltip")).toHaveTextContent(HINT)
    await user.pointer({ keys: "[TouchA]", target: tip() })
    await waitFor(() => {
      expect(shown()).toBeNull()
    })
  })

  it("closes on a tap elsewhere", async () => {
    const user = userEvent.setup()
    render(<Tip />)
    await user.pointer({ keys: "[TouchA]", target: tip() })
    expect(await screen.findByRole("tooltip")).toBeInTheDocument()
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Başka yer" }),
    })
    await waitFor(() => {
      expect(shown()).toBeNull()
    })
  })

  it("stays open when clicked with a mouse", async () => {
    const user = userEvent.setup()
    render(<Tip />)
    await user.click(tip())
    expect(await screen.findByRole("tooltip")).toHaveTextContent(HINT)
    await user.click(tip())
    expect(screen.getByRole("tooltip")).toHaveTextContent(HINT)
  })
})

describe("Field's help text", () => {
  it("folds into the (i) under FieldHints tip, the control described by it", () => {
    render(
      <FieldHints style="tip">
        <Field label="Başlık" term="title" htmlFor="baslik" hint={HINT}>
          <input id="baslik" />
        </Field>
      </FieldHints>
    )
    const input = screen.getByRole("textbox", { name: "Başlık" })
    expect(input).toHaveAccessibleDescription(HINT)
    expect(tip()).toHaveAccessibleDescription(HINT)
    // The words are in the page only as the hidden description
    expect(screen.getByText(HINT)).toHaveClass("sr-only")
  })

  it("keeps an error in sight in the tip style", () => {
    render(
      <FieldHints style="tip">
        <Field label="Başlık" htmlFor="baslik" hint={HINT} error="En çok 80 karakter.">
          <input id="baslik" />
        </Field>
      </FieldHints>
    )
    expect(screen.getByRole("alert")).toHaveTextContent("En çok 80 karakter.")
    expect(screen.getByRole("alert")).not.toHaveClass("sr-only")
  })

  it("stays a line under the field everywhere else", () => {
    render(
      <Field label="Başlık" htmlFor="baslik" hint={HINT}>
        <input id="baslik" />
      </Field>
    )
    expect(screen.queryByRole("button", { name: /Bilgi/ })).toBeNull()
    expect(screen.getByText(HINT)).not.toHaveClass("sr-only")
  })
})
