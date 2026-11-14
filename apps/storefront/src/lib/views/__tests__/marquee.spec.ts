import { describe, expect, it, vi } from "vitest"
import type { StoreMarqueeSection } from "@qticaret/types"
import { MARQUEE_DEFAULTS } from "@qticaret/types/section-marquee"
import { t } from "@/lib/i18n"

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }))

const { headerMarquee, marqueeView } = await import("../marquee")

const section = (over: Record<string, unknown> = {}) =>
  ({
    id: "kayan1",
    type: "marquee",
    items: [
      {
        icon: "truck",
        text: "Kargo bedava",
        subtext: null,
        link: { label: "Kargo", kind: "url", target: null, path: "/kargo" },
      },
      { icon: "rocket", text: "İade", subtext: "30 gün", link: null },
    ],
    speed: "fast",
    direction: "right",
    ground: "light",
    size: "small",
    separator: "line",
    ...over,
  }) as StoreMarqueeSection

describe("the scrolling strip's view (adr/0049 Ek 2026-11-14 §4.1)", () => {
  it("carries its items with their links as paths and its steps", () => {
    // A backend before the newer settings (adr/0049 Ek 2026-11-15): each reads as its default
    expect(marqueeView(section(), t)).toEqual({
      ...MARQUEE_DEFAULTS,
      id: "kayan1",
      type: "marquee",
      items: [
        {
          icon: "truck",
          text: "Kargo bedava",
          subtext: null,
          link: { label: "Kargo", path: "/kargo" },
        },
        // An icon this build does not draw is left out
        { icon: null, text: "İade", subtext: "30 gün", link: null },
      ],
      speed: "fast",
      direction: "right",
      ground: "light",
      size: "small",
      separator: "line",
    })
  })

  it("carries the newer settings as saved", () => {
    const set = {
      speed: "fastest",
      hover_pause: "off",
      pause_button: "hover",
      weight: "normal",
      uppercase: "on",
      gap: "tight",
      outline: "on",
      device: "desktop",
      closable: "on",
    }
    expect(marqueeView(section(set), t)).toMatchObject(set)
    expect(marqueeView(section({ pause_button: "none" }), t)).toMatchObject({
      pause_button: "always",
    })
  })

  it("reads a step it does not know as the default, and draws nothing without items", () => {
    expect(marqueeView(section({ size: "huge", ground: "neon" }), t)).toMatchObject({
      size: "medium",
      ground: "stage",
    })
    expect(marqueeView(section({ items: [] }), t)).toBeNull()
  })

  it("finds the header group's strip beside the announcement bar", () => {
    const header = [{ id: "duyuru", type: "announcement_bar" as const, lines: ["Kargo"] }]

    expect(headerMarquee(header, t)).toBeNull()
    expect(headerMarquee([...header, section()], t)).toMatchObject({ id: "kayan1" })
  })
})
