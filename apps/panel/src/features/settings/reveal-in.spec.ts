import { describe, expect, it } from "vitest"
import { revealIn } from "./reveal-in"

/** An element whose box is `top`..`bottom` on the screen (jsdom draws nothing). */
function boxed(top: number, bottom: number): HTMLElement {
  const element = document.createElement("div")
  element.getBoundingClientRect = () => ({ top, bottom }) as DOMRect
  return element
}

describe("revealIn", () => {
  it("scrolls the menu down just far enough to show a link below its end", () => {
    const menu = boxed(100, 500)
    revealIn(menu, boxed(520, 556))
    expect(menu.scrollTop).toBe(56)
  })

  it("scrolls it up to a link above its top", () => {
    const menu = boxed(100, 500)
    menu.scrollTop = 200
    revealIn(menu, boxed(60, 96))
    expect(menu.scrollTop).toBe(160)
  })

  it("leaves it where it is when the link already shows", () => {
    const menu = boxed(100, 500)
    menu.scrollTop = 40
    revealIn(menu, boxed(300, 336))
    expect(menu.scrollTop).toBe(40)
  })
})
