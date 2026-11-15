import { describe, expect, it } from "vitest"
import {
  EDITOR_BRIDGE_MAX_BYTES,
  bridgeMessage,
  readToPanel,
  readToStorefront,
} from "../editor-bridge.js"

describe("the theme editor's bridge messages (adr/0065 §2)", () => {
  it("reads the panel's messages as built", () => {
    const select = bridgeMessage("select", { id: "abc123", reveal: "always", flash: true }, 3)
    expect(readToStorefront(select)).toEqual(select)
    const navigate = bridgeMessage("navigate", { page: "/urun/bicak?renk=siyah" }, 4)
    expect(readToStorefront(navigate)).toEqual(navigate)
    expect(readToStorefront(bridgeMessage("refresh", { edition: null }, 0))).not.toBeNull()
    expect(
      readToStorefront(bridgeMessage("init", { scale: 0.5, selected: null }, 1))
    ).not.toBeNull()
  })

  it("reads the storefront's messages as built", () => {
    const ready = bridgeMessage(
      "ready",
      { v: 1, path: "/onizleme", edition: "2026-11-15T10:00:00.000Z" },
      0
    )
    expect(readToPanel(ready)).toEqual(ready)
    expect(readToPanel(bridgeMessage("key", { key: "undo" }, 2))).not.toBeNull()
    expect(
      readToPanel(bridgeMessage("missing", { id: "abc123", reason: "timeout" }, 2))
    ).not.toBeNull()
  })

  it("drops another channel, version or unknown type", () => {
    const select = bridgeMessage("select", { id: "abc123", reveal: "never", flash: false }, 1)
    expect(readToStorefront({ ...select, channel: "other" })).toBeNull()
    expect(readToStorefront({ ...select, v: 2 })).toBeNull()
    expect(readToStorefront({ ...select, type: "patch" })).toBeNull()
    expect(readToStorefront({ ...select, extra: 1 })).toBeNull()
    expect(readToStorefront({ ...select, payload: { ...select.payload, html: "<b>" } })).toBeNull()
    // A message of one direction is not one of the other
    expect(readToPanel(select)).toBeNull()
  })

  it("drops a section id that could leave a CSS selector", () => {
    for (const id of ['a"]{}', "ABCDEF", "abc", "a".repeat(25), "abc 123"]) {
      expect(
        readToStorefront({
          ...bridgeMessage("scroll-to", { id: "abc123", block: "start" }, 1),
          payload: { id, block: "start" },
        })
      ).toBeNull()
    }
  })

  it("navigates to a relative path only", () => {
    for (const page of [
      "//evil.example/x",
      "https://evil.example",
      "/\\evil",
      "urun/x",
      "/a\\b",
      "/" + "a".repeat(2048),
    ]) {
      expect(
        readToStorefront({ ...bridgeMessage("navigate", { page: null }, 1), payload: { page } })
      ).toBeNull()
    }
  })

  it("reads Faz 2's messages as built (hover, labels, click, navigate-request, location)", () => {
    const messages = [
      bridgeMessage("hover", { id: "abc123" }, 1),
      bridgeMessage("hover", { id: null }, 2),
      bridgeMessage("labels", { edit: "Düzenle", names: { abc123: "Öne çıkan <b>" } }, 3),
    ]
    for (const message of messages) {
      expect(readToStorefront(message)).toEqual(message)
    }
    const fromFrame = [
      bridgeMessage("hover", { id: null }, 1),
      bridgeMessage("click", { id: "abc123" }, 2),
      bridgeMessage("navigate-request", { path: "/arama?q=b%C4%B1%C3%A7ak", previewable: true }, 3),
      bridgeMessage("location", { path: "/urun/bicak", sections: ["abc123", "def456"] }, 4),
    ]
    for (const message of fromFrame) {
      expect(readToPanel(message)).toEqual(message)
    }
  })

  it("holds a frame's page to a relative path no decoder can turn into another host", () => {
    for (const path of [
      "//evil.example/x",
      "javascript:alert(1)",
      "https://evil.example",
      "/\\evil",
      "/%2F%2Fevil.example",
      "/%2fevil",
      "/%5Cevil",
      "/a%00b",
      "/a b",
      "/a\nb",
      "/a\tb",
      "urun/x",
      "/" + "a".repeat(2048),
    ]) {
      const request = bridgeMessage("navigate-request", { path: "/", previewable: true }, 1)
      expect(readToPanel({ ...request, payload: { path, previewable: true } })).toBeNull()
      const location = bridgeMessage("location", { path: "/", sections: [] }, 1)
      expect(readToPanel({ ...location, payload: { path, sections: [] } })).toBeNull()
    }
  })

  it("drops a click or hover on an id that is not a section's, and too many names", () => {
    expect(
      readToPanel({ ...bridgeMessage("click", { id: "abc123" }, 1), payload: { id: "x" } })
    ).toBeNull()
    const labels = bridgeMessage("labels", { edit: "Düzenle", names: {} }, 1)
    expect(readToStorefront({ ...labels, payload: { edit: "", names: {} } })).toBeNull()
    expect(
      readToStorefront({ ...labels, payload: { edit: "Düzenle", names: { 'a"]{}': "x" } } })
    ).toBeNull()
    const many = Object.fromEntries(
      Array.from({ length: 401 }, (_, index) => [`sec${String(index).padStart(4, "0")}`, "x"])
    )
    expect(readToStorefront({ ...labels, payload: { edit: "Düzenle", names: many } })).toBeNull()
    const location = bridgeMessage("location", { path: "/", sections: [] }, 1)
    expect(
      readToPanel({ ...location, payload: { path: "/", sections: Array(401).fill("abc123") } })
    ).toBeNull()
  })

  it("drops what is not an object, will not serialise or is larger than the limit", () => {
    expect(readToStorefront("select")).toBeNull()
    expect(readToStorefront(null)).toBeNull()
    const loop: Record<string, unknown> = {}
    loop["self"] = loop
    expect(readToStorefront(loop)).toBeNull()
    const big = {
      ...bridgeMessage("error", { code: "x" }, 1),
      padding: "x".repeat(EDITOR_BRIDGE_MAX_BYTES),
    }
    expect(readToPanel(big)).toBeNull()
  })
})
