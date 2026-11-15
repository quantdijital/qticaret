import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { VariantField } from "./variant-field"
import { VariantSketch } from "./variant-sketches"

const HEADERS = ["standard", "centered", "catalog"] as const

/** Each shape's box in the sketch's own units (rects and circles). */
function boxes(svg: SVGSVGElement) {
  const n = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
  return [...svg.querySelectorAll("rect, circle")].map((shape) =>
    shape.tagName === "circle"
      ? {
          left: n(shape, "cx") - n(shape, "r"),
          top: n(shape, "cy") - n(shape, "r"),
          right: n(shape, "cx") + n(shape, "r"),
          bottom: n(shape, "cy") + n(shape, "r"),
        }
      : {
          left: n(shape, "x"),
          top: n(shape, "y"),
          right: n(shape, "x") + n(shape, "width"),
          bottom: n(shape, "y") + n(shape, "height"),
        }
  )
}

/** adr/0049 Ek 2026-11-15: the header's three drawings in small, in the "Biçim" choice. */
describe("the header bar's sketches", () => {
  it.each(HEADERS)("draws %s in the shared frame, nothing past it", (variant) => {
    const { container } = render(<VariantSketch type="header_bar" variant={variant} />)
    const svg = container.querySelector("svg")
    if (!svg) {
      throw new Error("no sketch drawn")
    }
    expect(svg.getAttribute("viewBox")).toBe("0 0 112 32")
    const frame = svg.querySelector("[data-sketch-frame]")
    expect(frame?.getAttribute("x")).toBe("1")
    expect(frame?.getAttribute("y")).toBe("4")
    expect(frame?.getAttribute("width")).toBe("110")
    expect(frame?.getAttribute("height")).toBe("24")
    for (const box of boxes(svg)) {
      expect(box.left).toBeGreaterThanOrEqual(1)
      expect(box.top).toBeGreaterThanOrEqual(4)
      expect(box.right).toBeLessThanOrEqual(111)
      expect(box.bottom).toBeLessThanOrEqual(28)
    }
  })

  it("gives each choice its own whole edge, the third alone on its row too", () => {
    render(<VariantField id="v" type="header_bar" value="standard" onChange={() => undefined} />)
    const choices = screen.getAllByRole("radio")
    expect(choices).toHaveLength(3)
    for (const choice of choices) {
      // Joined items (spacing 0) drop the left edge and the outer corners of all but the first
      expect(choice).not.toHaveAttribute("data-spacing", "0")
      expect(choice.querySelector("svg")).not.toBeNull()
    }
    expect(screen.getByRole("radio", { name: /Klasik katalog/ })).toBeInTheDocument()
  })
})
