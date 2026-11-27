import { describe, expect, it } from "vitest"
import { ANNOUNCEMENT_DEFAULTS, TOP_SLIDER_DEFAULTS } from "@qticaret/types"
import { newTopStrip } from "./top-strip-kinds"

/** The top strip chooser's cards (owner 2026-11-27): each its own design. */
describe("a new top strip by its card", () => {
  it("starts the dark and light text strips as a new strip, one line to write", () => {
    expect(newTopStrip("graphite", "serit00001")).toMatchObject({
      type: "announcement_bar",
      variant: "graphite",
      lines: [""],
      ...ANNOUNCEMENT_DEFAULTS,
    })
    expect(newTopStrip("light", "serit00001")).toMatchObject({ variant: "light" })
  })

  it("starts the image slider empty, its own section, and the scrolling strip", () => {
    expect(newTopStrip("slider", "kaydirici1")).toEqual({
      id: "kaydirici1",
      type: "top_slider",
      visible: true,
      starts_at: null,
      ends_at: null,
      slides: [],
      ...TOP_SLIDER_DEFAULTS,
    })
    expect(newTopStrip("marquee", "kayan00001")).toMatchObject({ type: "marquee" })
  })
})
