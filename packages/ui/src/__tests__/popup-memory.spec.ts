// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  forgetPopupFallback,
  popupMemory,
  rememberDismissed,
  rememberShown,
  returningVisitor,
  sessionShown,
} from "../lib/popup-memory"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  forgetPopupFallback()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("what the browser remembers of the pop-ups", () => {
  it("keeps a showing's time and this session's showings", () => {
    rememberShown("popup_a", 1000)
    expect(popupMemory()).toEqual({ popup_a: { shown_at: 1000 } })
    expect([...sessionShown()]).toEqual(["popup_a"])
  })

  it("keeps a pop-up done with beside its showing", () => {
    rememberShown("popup_a", 1000)
    rememberDismissed("popup_a")
    expect(popupMemory()).toEqual({ popup_a: { shown_at: 1000, dismissed: true } })
  })

  it("forgets what it cannot read, never throws on it", () => {
    window.localStorage.setItem("qt:popups", "{bozuk")
    window.sessionStorage.setItem("qt:popups:session", '{"a":1}')
    expect(popupMemory()).toEqual({})
    expect(sessionShown().size).toBe(0)
    window.localStorage.setItem(
      "qt:popups",
      JSON.stringify({ popup_a: { shown_at: "dün", dismissed: "evet" }, popup_b: 3 })
    )
    expect(popupMemory()).toEqual({ popup_a: {} })
  })

  it("keeps fifty pop-ups at most, the latest shown", () => {
    for (let index = 0; index < 55; index++) {
      rememberShown(`popup_${String(index)}`, index)
    }
    const memory = popupMemory()
    expect(Object.keys(memory)).toHaveLength(50)
    expect(memory["popup_0"]).toBeUndefined()
    expect(memory["popup_54"]).toEqual({ shown_at: 54 })
  })
})

describe("a new or a returning visitor", () => {
  it("is new on the first visit for the whole session, returning in the next one", () => {
    expect(returningVisitor(1000)).toBe(false)
    // Another page of the same visit: still new
    expect(returningVisitor(2000)).toBe(false)
    // A new session: the mark from before says it came back
    window.sessionStorage.clear()
    expect(returningVisitor(3000)).toBe(true)
    expect(window.localStorage.getItem("qt:visited")).toBe("1000")
  })
})

describe("a storage that throws (blocked, full, a private window)", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError")
    })
  })

  it("never breaks the page, and keeps what it can for this page", () => {
    expect(popupMemory()).toEqual({})
    expect(() => {
      rememberShown("popup_a", 1000)
      rememberDismissed("popup_a")
    }).not.toThrow()
    expect(popupMemory()).toEqual({ popup_a: { shown_at: 1000, dismissed: true } })
    expect(sessionShown().has("popup_a")).toBe(true)
  })

  it("takes the visitor as new, and as new again on the same page", () => {
    expect(returningVisitor(1000)).toBe(false)
    expect(returningVisitor(2000)).toBe(false)
  })
})
