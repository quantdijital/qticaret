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
