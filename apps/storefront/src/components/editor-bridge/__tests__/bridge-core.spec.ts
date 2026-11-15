import { describe, expect, it } from "vitest"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import {
  acceptMessage,
  editorKey,
  needsScroll,
  previewHref,
  sectionSelector,
  selectionCss,
} from "../bridge-core"

/** The preview frame's side of the theme editor's bridge (adr/0065 §2, Faz 1). */

const PANEL = "https://panel.example.com"
const parent = { name: "the panel's window" }
const select = bridgeMessage("select", { id: "abc123", reveal: "if_hidden", flash: true }, 1)

describe("which messages the frame acts on", () => {
  it("takes a well-formed message from the panel's exact origin and framing window", () => {
    expect(acceptMessage({ origin: PANEL, source: parent, data: select }, PANEL, parent)).toEqual(
      select
    )
  })

  it("drops another origin, a look-alike or a different window", () => {
    for (const origin of [
      "https://evil.example.com",
      "https://panel.example.com.evil.com",
      "http://panel.example.com",
      "null",
      "",
    ]) {
      expect(acceptMessage({ origin, source: parent, data: select }, PANEL, parent)).toBeNull()
    }
    expect(acceptMessage({ origin: PANEL, source: {}, data: select }, PANEL, parent)).toBeNull()
    expect(acceptMessage({ origin: PANEL, source: null, data: select }, PANEL, null)).toBeNull()
  })

  it("drops everything without a panel origin to compare with", () => {
    expect(acceptMessage({ origin: "", source: parent, data: select }, "", parent)).toBeNull()
  })

  it("drops a message off the schema, a later phase's type or a storefront message", () => {
    const off = [
      { ...select, payload: { id: 'x"]{}', reveal: "always", flash: true } },
      { ...select, type: "patch" },
      bridgeMessage("ready", { v: 1, path: "/", edition: null }, 0),
      "select",
    ]
    for (const data of off) {
      expect(acceptMessage({ origin: PANEL, source: parent, data }, PANEL, parent)).toBeNull()
    }
  })
})

describe("finding and showing a section", () => {
  it("builds a selector for a section id only", () => {
    expect(sectionSelector("abc123")).toBe('[data-qs="abc123"]')
    expect(sectionSelector('a"] body {')).toBeNull()
  })

  it("scrolls always, never, or only when no part of the section shows", () => {
    expect(needsScroll({ top: 10, bottom: 200 }, 800, "if_hidden")).toBe(false)
    expect(needsScroll({ top: -300, bottom: 5 }, 800, "if_hidden")).toBe(false)
    expect(needsScroll({ top: 900, bottom: 1200 }, 800, "if_hidden")).toBe(true)
    expect(needsScroll({ top: -500, bottom: -10 }, 800, "if_hidden")).toBe(true)
    expect(needsScroll({ top: 10, bottom: 200 }, 800, "always")).toBe(true)
    expect(needsScroll({ top: 900, bottom: 1200 }, 800, "never")).toBe(false)
  })

  it("keeps the outline's width on screen whatever the scale, and flashes by number", () => {
    expect(selectionCss("abc123", 1, null)).toContain('[data-qs="abc123"]{outline:2px solid')
    expect(selectionCss("abc123", 0.5, null)).toContain("outline:4px solid")
    const flashing = selectionCss("abc123", 1, { id: "def456", n: 3, reduced: false })
    expect(flashing).toContain("@keyframes qt-editor-flash-3")
    expect(flashing).toContain('[data-qs="def456"]{animation:qt-editor-flash-3 1.2s')
    const still = selectionCss(null, 1, { id: "def456", n: 4, reduced: true })
    expect(still).not.toContain("animation")
    expect(still).toContain('[data-qs="def456"]{outline:4px solid')
  })

  it("writes nothing for an id that is not one", () => {
    expect(selectionCss("x}body{display:none", 1, { id: "y}", n: 1, reduced: false })).toBe("")
    expect(selectionCss(null, 1, null)).toBe("")
  })
})

describe("the editor's keys in the frame", () => {
  const key = (over: Partial<Parameters<typeof editorKey>[0]>) =>
    editorKey({
      key: "z",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      target: { tagName: "DIV" },
      ...over,
    })

  it("passes undo, redo and Escape to the panel", () => {
    expect(key({ ctrlKey: true })).toBe("undo")
    expect(key({ metaKey: true })).toBe("undo")
    expect(key({ metaKey: true, shiftKey: true })).toBe("redo")
    expect(key({ ctrlKey: true, key: "y" })).toBe("redo")
    expect(key({ key: "Escape" })).toBe("escape")
  })

  it("leaves a field of the page its own keys, and plain letters alone", () => {
    expect(key({ ctrlKey: true, target: { tagName: "INPUT" } })).toBeNull()
    expect(key({ key: "Escape", target: { tagName: "textarea" } })).toBeNull()
    expect(key({ ctrlKey: true, target: { tagName: "DIV", isContentEditable: true } })).toBeNull()
    expect(key({})).toBeNull()
    expect(key({ ctrlKey: true, altKey: true })).toBeNull()
  })
})

describe("another page in the same frame", () => {
  it("keeps the session's path and carries the page in ?sayfa=", () => {
    const path = `/onizleme/sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
    expect(previewHref(path, null)).toBe(path)
    expect(previewHref(path, "/urun/bicak?renk=siyah")).toBe(
      `${path}?sayfa=%2Furun%2Fbicak%3Frenk%3Dsiyah`
    )
  })
})
