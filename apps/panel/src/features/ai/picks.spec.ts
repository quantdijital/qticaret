import { describe, expect, it } from "vitest"
import { readPicks } from "./picks"

describe("readPicks (adr/0074 §5 madde 2)", () => {
  it("keeps records with an id and a name, and new tags, nothing else", () => {
    expect(
      readPicks({
        picked: [{ id: "ptag_1", name: "keten", price: 10 }, { id: "", name: "boş" }, "ptag_2"],
        new_tags: ["yaz sezonu", "yaz sezonu", "", 3],
        price: 100,
      })
    ).toEqual({ picked: [{ id: "ptag_1", name: "keten" }], new_tags: ["yaz sezonu"] })
  })

  it("is null for an answer with no picks", () => {
    expect(readPicks(null)).toBeNull()
    expect(readPicks({ title: "Kart" })).toBeNull()
    expect(readPicks("metin")).toBeNull()
  })
})
