import { describe, expect, it } from "vitest"
import { trackInputMode } from "./input-mode"

describe("trackInputMode", () => {
  it("is keyboard after Tab and pointer after a click; other keys change nothing", () => {
    trackInputMode(document)
    const mode = () => document.documentElement.dataset["input"]

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }))
    expect(mode()).toBe("keyboard")
    document.dispatchEvent(new Event("pointerdown"))
    expect(mode()).toBe("pointer")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }))
    expect(mode()).toBe("pointer")
  })
})
