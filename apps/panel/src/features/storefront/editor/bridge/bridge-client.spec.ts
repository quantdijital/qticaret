import { describe, expect, it } from "vitest"
import { EDITOR_BRIDGE_MAX_BYTES, bridgeMessage } from "@qticaret/types/editor-bridge"
import type { AnySection } from "@/features/storefront/api/layout"
import {
  KEYS_PER_SECOND,
  acceptFromFrame,
  bridgeOn,
  createKeyGate,
  frameOrigin,
  whyNotShown,
} from "./bridge-client"
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

  it("takes a field's label (Faz 2b) only from the frame, with a key of the schema's form", () => {
    const field = bridgeMessage("field", { id: "giris1", field: "slides.2.heading" }, 3)
    const take = (data: unknown, origin = ORIGIN, source: unknown = frameWindow) =>
      acceptFromFrame({ origin, source, data }, ORIGIN, frameWindow)
    expect(take(field)).toEqual(field)
    expect(take(field, "https://evil.example")).toBeNull()
    expect(take(field, ORIGIN, {})).toBeNull()
    // A key that is not one (a selector, markup, too deep, too long) is dropped whole
    for (const key of [
      '"]{}',
      "<img src=x>",
      "Heading",
      "a.b.c.d.e",
      "slides.100.heading",
      `a${"b".repeat(80)}`,
      "",
    ]) {
      expect(take(bridgeMessage("field", { id: "giris1", field: key }, 4))).toBeNull()
    }
    expect(take(bridgeMessage("field", { id: "a],[b", field: "heading" }, 5))).toBeNull()
    expect(take({ ...field, payload: { ...field.payload, extra: 1 } })).toBeNull()
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

  it("runs the bridge only with a frame origin the build names (security review 2026-11-15)", () => {
    // Development's derived origin, or `VITE_STOREFRONT_ORIGIN`
    expect(bridgeOn(undefined, ORIGIN)).toBe(true)
    expect(bridgeOn("true", "https://shop.example")).toBe(true)
    // A production build without `VITE_STOREFRONT_ORIGIN`: shut, signed links instead
    expect(bridgeOn(undefined, null)).toBe(false)
    expect(bridgeOn("true", null)).toBe(false)
    // Turned off by the build
    expect(bridgeOn(" FALSE ", ORIGIN)).toBe(false)
  })

  it("takes the frame's keys only while it has the focus, five a second at most", () => {
    const gate = createKeyGate()
    expect(gate(false, 0)).toBe(false)
    const burst = Array.from({ length: 8 }, (_, index) => gate(true, index * 10))
    expect(burst).toEqual([true, true, true, true, true, false, false, false])
    // A second after the first one, room for one more; refusals took none
    expect(gate(true, 999)).toBe(false)
    expect(gate(true, 1000)).toBe(true)
    expect(gate(true, 1001)).toBe(false)
    expect(gate(true, 1040)).toBe(true)
    expect(KEYS_PER_SECOND).toBe(5)
  })
})
