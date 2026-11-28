import { describe, expect, it } from "vitest"
import { hasNewVersion, isLook, presetFamilies, sectorRuns, shownMember } from "./families"
import { preset } from "./gallery.fixtures"

const GECE = preset("tezgah-gece", { family: "tezgah", swatch: "Gece", name: "Tezgâh · Gece" })
const OWN = preset("tezgah", { family: "tezgah", swatch: "Lacivert ve çelik", name: "Tezgâh" })
const KUM = preset("tezgah-kum", { family: "tezgah", swatch: "Kum", name: "Tezgâh · Kum" })
const TEZGAH = [GECE, OWN, KUM]

describe("presetFamilies", () => {
  it("draws a family of colour sets as one card, its own look first", () => {
    const families = presetFamilies([preset("sade"), ...TEZGAH])

    expect(families.map((each) => [each.key, each.name])).toEqual([
      ["general/sade", "Sade"],
      ["general/tezgah", "Tezgâh"],
    ])
    expect(families[1]?.members.map((each) => each.code)).toEqual([
      "tezgah",
      "tezgah-gece",
      "tezgah-kum",
    ])
  })

  it("names a family without its own look from its members' names, up to the dot", () => {
    const [family] = presetFamilies(TEZGAH.filter((each) => each.code !== "tezgah"))

    expect(family?.name).toBe("Tezgâh")
    expect(family?.members.map((each) => each.code)).toEqual(["tezgah-gece", "tezgah-kum"])
  })

  it("keeps the same family code of two packs apart", () => {
    const families = presetFamilies([preset("sade"), preset("sade", { pack: "cutlery" })])

    expect(families.map((each) => each.key)).toEqual(["general/sade", "cutlery/sade"])
  })
})

describe("shownMember", () => {
  it("shows the colour set in the draft, else the live one, else the family's own", () => {
    const shown = (members = TEZGAH) => {
      const [family] = presetFamilies(members)
      return family ? shownMember(family)?.code : undefined
    }

    expect(shown()).toBe("tezgah")
    expect(shown([GECE, { ...OWN, live: 1 }, { ...KUM, in_draft: 1 }])).toBe("tezgah-kum")
    expect(shown([{ ...GECE, live: 1 }, OWN, KUM])).toBe("tezgah-gece")
  })
})

describe("sectorRuns", () => {
  it("puts the shop's own sector first, then each other sector under its name (owner, 2026-11-28)", () => {
    const other = (code: string, sector: string, name: string) =>
      preset(code, { pack: sector, own: false, sector: { code: sector, name } })
    const runs = sectorRuns(
      presetFamilies([
        other("tezgah", "cutlery", "Bıçak ve çatal-bıçak"),
        preset("vadi", { pack: "travel" }),
        other("katalog", "cutlery", "Bıçak ve çatal-bıçak"),
        other("cicek", "flowers", "Çiçek"),
      ])
    )

    expect(runs.own.map((each) => each.key)).toEqual(["travel/vadi"])
    expect(runs.others.map((run) => [run.code, run.name, run.families.map((f) => f.key)])).toEqual([
      ["cutlery", "Bıçak ve çatal-bıçak", ["cutlery/tezgah", "cutlery/katalog"]],
      ["flowers", "Çiçek", ["flowers/cicek"]],
    ])
  })
})

describe("isLook and hasNewVersion", () => {
  it("knows a look at any version, and a newer one than the draft or live has", () => {
    const sade = preset("sade", { version: 3 })

    expect(isLook(sade, { pack: "general", code: "sade", version: 1 })).toBe(true)
    expect(isLook(sade, { pack: "cutlery", code: "sade", version: 3 })).toBe(false)
    expect(isLook(sade, null)).toBe(false)

    expect(hasNewVersion(sade)).toBe(false)
    expect(hasNewVersion({ ...sade, in_draft: 3, live: 3 })).toBe(false)
    expect(hasNewVersion({ ...sade, in_draft: 3, live: 2 })).toBe(true)
    expect(hasNewVersion({ ...sade, in_draft: 1 })).toBe(true)
  })
})
