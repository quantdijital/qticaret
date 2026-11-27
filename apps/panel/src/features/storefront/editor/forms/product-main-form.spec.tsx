import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductMainSection } from "@/features/storefront/api/layout-main"
import { ProductMainForm } from "./product-main-form"

// The product block's gallery shape: the square leaves no field behind
const SECTION: ProductMainSection = {
  id: "mainproduct",
  type: "product_main",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "standard",
}

function draw(section: ProductMainSection) {
  const onChange = vi.fn<(section: ProductMainSection) => void>()
  render(<ProductMainForm section={section} problems={{}} onChange={onChange} />)
  return onChange
}

describe("the product block's form", () => {
  it("saves a landscape gallery, and the square as no field", () => {
    const onChange = draw(SECTION)
    fireEvent.click(screen.getByText("Yatay 4:3"))
    expect(onChange).toHaveBeenLastCalledWith({ ...SECTION, image_ratio: "landscape" })
    cleanup()
    const shaped = draw({ ...SECTION, image_ratio: "portrait" })
    fireEvent.click(screen.getByText("Kare"))
    expect(shaped).toHaveBeenLastCalledWith(SECTION)
  })

  it("shows the assurances by default, saves them off, and on again as no field", () => {
    const onChange = draw(SECTION)
    const toggle = screen.getByRole("switch", {
      name: /Satın alma alanının altında güvenceleri göster/,
    })
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenLastCalledWith({ ...SECTION, assurances: false })
    cleanup()
    const hidden = draw({ ...SECTION, assurances: false })
    const off = screen.getByRole("switch", {
      name: /Satın alma alanının altında güvenceleri göster/,
    })
    expect(off).not.toBeChecked()
    fireEvent.click(off)
    expect(hidden).toHaveBeenLastCalledWith(SECTION)
  })
})
