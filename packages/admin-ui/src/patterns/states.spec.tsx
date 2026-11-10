import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LoadingRows } from "./states"

describe("LoadingRows", () => {
  it("says it is loading in text, not in an aria-label a plain div may not carry", () => {
    const { container } = render(<LoadingRows rows={2} />)
    const box = container.firstElementChild
    expect(box).toHaveAttribute("aria-busy", "true")
    // axe aria-prohibited-attr: a div with no role cannot be named
    expect(box).not.toHaveAttribute("aria-label")
    expect(screen.getByText("Yükleniyor")).toHaveClass("sr-only")
  })
})
