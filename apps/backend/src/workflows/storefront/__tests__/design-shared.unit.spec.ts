import { presetName } from "../design-shared"

describe("a ready-made look's name (adr/0064 Ek 2026-11-17)", () => {
  it("reads the name of a look this build has", () => {
    expect(presetName("cutlery", "katalog")).toBe("Katalog")
  })

  it("has none for a look this build no longer has, never failing", () => {
    // general/grafit was removed (owner, 2026-11-17); shops' designs may still name it
    expect(presetName("general", "grafit")).toBeNull()
    expect(presetName("yok", "yok")).toBeNull()
  })
})
