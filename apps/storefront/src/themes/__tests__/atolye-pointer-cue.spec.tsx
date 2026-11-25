// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PointerCue } from "../../../../../packages/themes/atolye/src/frame/PointerCue"

/**
 * `PointerCue` (owner 2026-11-26): `<html>` carries `data-js-pointer` from
 * a press until the next Tab, so a clicked search field keeps no frame
 * (`search-fields.css`) while a keyboard visitor's ring shows; typing in a
 * clicked field keeps the mark, and nothing is left behind on unmount.
 */

let host: HTMLDivElement
let root: Root
const marked = () => document.documentElement.hasAttribute("data-js-pointer")

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  act(() => {
    root.render(<PointerCue />)
  })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  document.body.replaceChildren()
})

describe("the pointer cue", () => {
  it("marks the page on a press and lets go on the next Tab, not on typing", () => {
    expect(marked()).toBe(false)
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    expect(marked()).toBe(true)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))
    expect(marked()).toBe(true)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    expect(marked()).toBe(false)
  })

  it("leaves no mark once unmounted", () => {
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    act(() => {
      root.unmount()
    })
    expect(marked()).toBe(false)
    root = createRoot(host)
  })
})
