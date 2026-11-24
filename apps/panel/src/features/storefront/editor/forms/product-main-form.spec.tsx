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
})
