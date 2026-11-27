import { describe, expect, it } from "vitest"
import { ANNOUNCEMENT_DEFAULTS } from "@qticaret/types"
import { newTopStrip } from "./top-strip-kinds"

const LINES = ["Kargo bedava", "Özenle paketlenir"]

/** The top strip chooser's cards (owner 2026-11-27): each a strip set as its card shows. */
describe("a new top strip by its card", () => {
  it("starts the dark and light strips as a new strip, one line to write", () => {
    expect(newTopStrip("graphite", "serit00001", LINES)).toMatchObject({
      variant: "graphite",
      lines: [""],
      ...ANNOUNCEMENT_DEFAULTS,
    })
    expect(newTopStrip("light", "serit00001", LINES)).toMatchObject({ variant: "light" })
  })

  it("starts the slider turning its sample lines one at a time, sliding, with arrows", () => {
    expect(newTopStrip("slider", "serit00001", LINES)).toMatchObject({
      type: "announcement_bar",
      variant: "graphite",
      lines: LINES,
      mode: "rotate",
      transition: "slide",
      arrows: "on",
    })
    expect(newTopStrip("marquee", "kayan00001", LINES)).toMatchObject({ type: "marquee" })
  })
})
