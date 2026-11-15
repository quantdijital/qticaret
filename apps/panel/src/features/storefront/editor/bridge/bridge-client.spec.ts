import { describe, expect, it } from "vitest"
import { EDITOR_BRIDGE_MAX_BYTES, bridgeMessage } from "@qticaret/types/editor-bridge"
import type { AnySection } from "@/features/storefront/api/layout"
import { acceptFromFrame, frameOrigin, whyNotShown } from "./bridge-client"
import { renewEvery } from "./use-editor-session"

const ORIGIN = "http://localhost:8000"
const frameWindow = { name: "the frame" }
const ready = bridgeMessage("ready", { v: 1, path: "/", edition: null }, 0)

describe("the panel's bridge client (adr/0065 §2, §7)", () => {
  it("takes the frame's exact origin, only for an http(s) address", () => {
    expect(frameOrigin("http://localhost:8000/onizleme/sfs_x?sayfa=%2Furun")).toBe(ORIGIN)
    expect(frameOrigin("https://shop.example.com:8443/onizleme/sfs_x")).toBe(
      "https://shop.example.com:8443"
    )
    expect(frameOrigin(null)).toBeNull()
    expect(frameOrigin("/onizleme/sfs_x")).toBeNull()
    expect(frameOrigin("javascript:alert(1)")).toBeNull()
    expect(frameOrigin("data:text/html,<p>")).toBeNull()
  })

  it("takes a message only from the frame's origin and its own window", () => {
    expect(
      acceptFromFrame({ origin: ORIGIN, source: frameWindow, data: ready }, ORIGIN, frameWindow)
    ).toEqual(ready)
    // Another origin, a look-alike or a port off
    for (const origin of [
      "https://evil.example",
      "http://localhost:8001",
      "http://localhost",
      "null",
    ]) {
      expect(
        acceptFromFrame({ origin, source: frameWindow, data: ready }, ORIGIN, frameWindow)
      ).toBeNull()
    }
    // The right origin from another window (a second tab, a nested frame, the panel itself)
    expect(
      acceptFromFrame({ origin: ORIGIN, source: {}, data: ready }, ORIGIN, frameWindow)
    ).toBeNull()
    expect(
      acceptFromFrame({ origin: ORIGIN, source: null, data: ready }, ORIGIN, frameWindow)
    ).toBeNull()
    // No frame (yet), or an address without an origin: nothing is taken
    expect(acceptFromFrame({ origin: ORIGIN, source: null, data: ready }, ORIGIN, null)).toBeNull()
    expect(
      acceptFromFrame({ origin: ORIGIN, source: frameWindow, data: ready }, null, frameWindow)
    ).toBeNull()
  })

  it("drops what does not fit the schema or is larger than 64 KB", () => {
    const take = (data: unknown) =>
      acceptFromFrame({ origin: ORIGIN, source: frameWindow, data }, ORIGIN, frameWindow)
    expect(take({ ...ready, extra: true })).toBeNull()
    expect(take({ ...ready, v: 2 })).toBeNull()
    expect(take({ ...ready, channel: "other" })).toBeNull()
    expect(take({ ...ready, type: "eval" })).toBeNull()
    expect(take("ready")).toBeNull()
    // A section id that is not one of ours (a selector in disguise)
    expect(take(bridgeMessage("missing", { id: "a],[b", reason: "hidden" } as never, 1))).toBeNull()
    const big = "x".repeat(EDITOR_BRIDGE_MAX_BYTES)
    expect(take({ ...bridgeMessage("error", { code: "boom" }, 1), padding: big })).toBeNull()
    expect(take(bridgeMessage("error", { code: "x".repeat(40) }, 1))).not.toBeNull()
  })

  it("says why a section would not show on the page in the frame", () => {
    const now = new Date("2026-11-15T12:00:00.000Z")
    const section = (more: object) =>
      ({ id: "abc123", type: "text", ...more }) as unknown as AnySection
    expect(whyNotShown({ group: "home", section: section({}) }, "home", now)).toBeNull()
    expect(whyNotShown({ group: "header", section: section({}) }, "product", now)).toBeNull()
    expect(whyNotShown({ group: "home", section: section({ visible: false }) }, "home", now)).toBe(
      "hidden"
    )
    expect(
      whyNotShown(
        { group: "home", section: section({ starts_at: "2026-11-16T00:00:00.000Z" }) },
        "home",
        now
      )
    ).toBe("scheduled")
    expect(
      whyNotShown(
        { group: "home", section: section({ ends_at: "2026-11-15T12:00:00.000Z" }) },
        "home",
        now
      )
    ).toBe("scheduled")
    expect(whyNotShown({ group: "product", section: section({}) }, "home", now)).toBe("other_page")
  })

  it("renews the session well inside its idle time, not too often", () => {
    expect(renewEvery(30 * 60_000)).toBe(5 * 60_000)
    expect(renewEvery(6 * 60_000)).toBe(2 * 60_000)
    expect(renewEvery(1000)).toBe(30_000)
  })
})
