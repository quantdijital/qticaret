import { act, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, describe, expect, it } from "vitest"
import { Toaster } from "./toaster"

// Without an i18n instance a text is its key
describe("Toaster", () => {
  afterEach(() => {
    act(() => {
      toast.dismiss()
    })
  })

  it("draws the close button at the end of the row, on the text's first line", async () => {
    render(<Toaster />)
    act(() => {
      toast.success("Ürün kaydedildi", { description: "Vitrinde görünüyor." })
    })

    const close = await screen.findByRole("button", { name: "common.close" })
    // Sonner puts it first in the markup; the order draws it last
    expect(close).toHaveClass("order-last")
    // 24 px with -2 px margins: as tall as a 20 px line, so centred on it
    expect(close).toHaveClass("h-6", "w-6", "-my-0.5")
    expect(close.querySelector("svg")).toHaveClass("lucide-x")

    const toastEl = close.closest("[data-sonner-toast]")
    expect(toastEl).toHaveClass("items-start")
    expect(toastEl?.querySelector("[data-icon]")).toHaveClass("h-5")
    // The text takes the free width, pushing the button to the edge
    expect(toastEl?.querySelector("[data-content]")).toHaveClass("flex-1")
  })
})
