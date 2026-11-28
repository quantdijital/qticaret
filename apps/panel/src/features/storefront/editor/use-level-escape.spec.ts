import { afterEach, describe, expect, it } from "vitest"
import { escapeGoesUp } from "./use-level-escape"

const press = (init: KeyboardEventInit, target: EventTarget = document.body) => {
  const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true, ...init })
  Object.defineProperty(event, "target", { value: target })
  return event
}

describe("Escape in the side panel", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("goes up a step from a field or the page", () => {
    const field = document.createElement("input")
    document.body.append(field)
    expect(escapeGoesUp(press({}))).toBe(true)
    expect(escapeGoesUp(press({}, field))).toBe(true)
    expect(escapeGoesUp(press({ key: "Enter" }))).toBe(false)
  })

  it("leaves a word being composed, a search with a query and a layer on screen alone", () => {
    expect(escapeGoesUp(press({ isComposing: true }))).toBe(false)
    const handled = press({})
    handled.preventDefault()
    expect(escapeGoesUp(handled)).toBe(false)

    const search = document.createElement("input")
    search.type = "search"
    search.value = "margin"
    document.body.append(search)
    expect(escapeGoesUp(press({}, search))).toBe(false)

    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    document.body.append(dialog)
    expect(escapeGoesUp(press({}))).toBe(false)
  })
})
