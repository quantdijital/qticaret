import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { customerNoteOf } from "@/features/orders/customer-note"
import { CustomerNoteCard } from "./customer-note"

/** Batch 8 / O1: the shopper's note at checkout, beside the customer. */
describe("CustomerNoteCard", () => {
  it("shows the note as plain text with its line breaks", () => {
    render(
      <CustomerNoteCard metadata={{ qt_order_note: "Zili çalmayın\n<b>kapıya</b> bırakın" }} />
    )
    expect(screen.getByRole("heading", { name: "Müşterinin notu" })).toBeInTheDocument()
    const text = screen.getByText(/Zili çalmayın/)
    expect(text.textContent).toBe("Zili çalmayın\n<b>kapıya</b> bırakın")
    expect(text.querySelector("b")).toBeNull()
  })

  it("draws nothing without a note", () => {
    const { container } = render(<CustomerNoteCard metadata={{ other: "x" }} />)
    expect(container).toBeEmptyDOMElement()
    expect(customerNoteOf({ qt_order_note: "  " })).toBeNull()
    expect(customerNoteOf(null)).toBeNull()
    expect(customerNoteOf({ qt_order_note: 4 })).toBeNull()
  })
})
