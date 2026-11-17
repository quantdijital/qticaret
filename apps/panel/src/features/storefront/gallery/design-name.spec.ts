import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import {
  NAME_MAX,
  dayAndTime,
  dayOf,
  designName,
  lookName,
  sourceName,
  suggestedName,
} from "./design-name"
import { design, preset, summary } from "./gallery.fixtures"

const t = i18next.t.bind(i18next)
// 14:20 in Istanbul, whatever the machine's zone
const AT = "2026-11-17T11:20:00.000Z"

describe("dates", () => {
  it("reads the shop's day and time in Turkey", () => {
    expect(dayAndTime(AT)).toBe("17 Kasım 14:20")
    expect(dayOf("2026-11-17T22:30:00.000Z")).toBe("18 Kasım")
  })
})

describe("designName", () => {
  it("keeps a named look's own name", () => {
    expect(designName(t, design("sfd_1"))).toBe("Bayram vitrini")
  })

  it("names an automatic save from where it came from, when, and whether it was changed", () => {
    const auto = design("sfd_2", { kind: "auto", name: null, created_at: AT })

    expect(designName(t, auto)).toBe("Sade, 17 Kasım 14:20")
    expect(designName(t, { ...auto, summary: summary({ edited: true }) })).toBe(
      "Sade, 17 Kasım 14:20, düzenlenmiş"
    )
    expect(designName(t, { ...auto, summary: summary({ source: "own", source_name: null }) })).toBe(
      "Kendi tasarımınız, 17 Kasım 14:20"
    )
  })

  it("calls the shop's own work its own even when a name came along", () => {
    expect(sourceName(t, summary({ source: "own", source_name: "Sade" }))).toBe("Kendi tasarımınız")
    expect(sourceName(t, summary({ source: "design", source_name: "Bayram vitrini" }))).toBe(
      "Bayram vitrini"
    )
  })
})

describe("lookName", () => {
  const presets = [preset("sade", { version: 2 })]
  const designs = [design("sfd_1")]

  it("names the draft by the saved look given it, else the ready-made one, else the shop's own", () => {
    const sade = { pack: "general", code: "sade", version: 1 }

    expect(lookName(t, { preset: sade, design_id: "sfd_1" }, presets, designs)).toBe(
      "Bayram vitrini"
    )
    expect(lookName(t, { preset: sade, design_id: null }, presets, designs)).toBe("Sade")
    // A deleted saved look falls back to the ready-made one under it
    expect(lookName(t, { preset: sade, design_id: "sfd_gone" }, presets, designs)).toBe("Sade")
    expect(lookName(t, { preset: null, design_id: null }, presets, designs)).toBe(
      "Kendi tasarımınız"
    )
  })

  it("calls a draft naming a look this build no longer has the shop's own", () => {
    // general/grafit was removed (owner, 2026-11-17); a shop's draft may still name it
    const gone = { pack: "general", code: "grafit", version: 1 }

    expect(lookName(t, { preset: gone, design_id: null }, presets, designs)).toBe(
      "Kendi tasarımınız"
    )
    // A save made from it: the server finds no name for it
    const auto = design("sfd_3", {
      kind: "auto",
      name: null,
      created_at: AT,
      summary: summary({ source: "preset", source_name: null, preset: gone }),
    })
    expect(designName(t, auto)).toBe("Kendi tasarımınız, 17 Kasım 14:20")
  })
})

describe("suggestedName", () => {
  it("offers the source and today's date, cut to the server's limit", () => {
    const now = new Date(AT)

    expect(suggestedName(t, "Sade", now)).toBe("Sade, 17 Kasım")
    expect(suggestedName(t, "x".repeat(80), now)).toHaveLength(NAME_MAX)
  })
})
