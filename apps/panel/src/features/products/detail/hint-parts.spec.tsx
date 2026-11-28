import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FieldHints } from "@qticaret/admin-ui/hooks/use-field-hints"
import { FormNote, SwitchName } from "./hint-parts"

const HINT = "Kalkış tarihleriyle satılır."

function Row() {
  return (
    <>
      <SwitchName htmlFor="booking" label="Tarihli" term="booking_mode" hint={HINT} hintId="h" />
      <input id="booking" type="checkbox" aria-describedby="h" />
    </>
  )
}

// The panel's tests read i18n keys, not the words

/** The product page's own help lines (the owner's "yazı kalabalığı", docs/18 §7.1). */
describe("product page hints", () => {
  it("folds a switch's words into the (i) under FieldHints tip, still its description", () => {
    render(
      <FieldHints style="tip">
        <Row />
      </FieldHints>
    )
    expect(screen.getByRole("checkbox", { name: "Tarihli" })).toHaveAccessibleDescription(HINT)
    expect(screen.getByRole("button", { name: "infoTip.label" })).toBeInTheDocument()
    expect(screen.getByText(HINT)).toHaveClass("sr-only")
    expect(screen.getByText("booking_mode")).toBeInTheDocument()
  })

  it("keeps a switch's words as a line elsewhere", () => {
    render(<Row />)
    expect(screen.getByRole("checkbox", { name: "Tarihli" })).toHaveAccessibleDescription(HINT)
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getByText(HINT)).not.toHaveClass("sr-only")
  })

  it("keeps a form note's state in sight and folds its explanation", () => {
    render(
      <FieldHints style="tip">
        <FormNote name="Kargo" hint="İsteğe bağlı ölçüler." state="Girilmedi" />
      </FieldHints>
    )
    expect(screen.getByText("Girilmedi")).toBeVisible()
    expect(screen.queryByText("İsteğe bağlı ölçüler.")).toBeNull()
    expect(screen.getByRole("button", { name: "infoTip.label" })).toBeInTheDocument()
  })

  it("asks what a form is for when there is no state, and is one line elsewhere", () => {
    const { unmount } = render(
      <FieldHints style="tip">
        <FormNote name="Katalog" hint="Listelerde kullanılır." />
      </FieldHints>
    )
    expect(screen.getByText("products.detail.aboutForm")).toBeInTheDocument()
    unmount()
    render(<FormNote name="Katalog" hint="Listelerde kullanılır." state="Girilmedi" />)
    expect(screen.getByText("Listelerde kullanılır. Girilmedi")).toBeInTheDocument()
  })
})
