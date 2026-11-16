import { describe, expect, it } from "vitest"
import { hasNewVersion, isLook, presetFamilies, shownMember } from "./families"
import { preset } from "./gallery.fixtures"

const GECE = preset("tezgah-gece", { family: "tezgah", swatch: "Gece", name: "Tezgâh · Gece" })
const OWN = preset("tezgah", { family: "tezgah", swatch: "Lacivert ve çelik", name: "Tezgâh" })
const KUM = preset("tezgah-kum", { family: "tezgah", swatch: "Kum", name: "Tezgâh · Kum" })
const TEZGAH = [GECE, OWN, KUM]

describe("presetFamilies", () => {
  it("draws a family of colour sets as one card, its own look first", () => {
    const families = presetFamilies([preset("grafit"), ...TEZGAH])

    expect(families.map((each) => [each.key, each.name])).toEqual([
      ["general/grafit", "Grafit"],
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
    const families = presetFamilies([preset("grafit"), preset("grafit", { pack: "cutlery" })])

    expect(families.map((each) => each.key)).toEqual(["general/grafit", "cutlery/grafit"])
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

describe("isLook and hasNewVersion", () => {
  it("knows a look at any version, and a newer one than the draft or live has", () => {
    const grafit = preset("grafit", { version: 3 })

    expect(isLook(grafit, { pack: "general", code: "grafit", version: 1 })).toBe(true)
    expect(isLook(grafit, { pack: "cutlery", code: "grafit", version: 3 })).toBe(false)
    expect(isLook(grafit, null)).toBe(false)

    expect(hasNewVersion(grafit)).toBe(false)
    expect(hasNewVersion({ ...grafit, in_draft: 3, live: 3 })).toBe(false)
    expect(hasNewVersion({ ...grafit, in_draft: 3, live: 2 })).toBe(true)
    expect(hasNewVersion({ ...grafit, in_draft: 1 })).toBe(true)
  })
})
