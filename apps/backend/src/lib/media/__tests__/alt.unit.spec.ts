import { ALT_MAX, suggestedAlts } from "../alt"

const plain = { variantIds: [] }

describe("suggested alt texts", () => {
  it("names the product, and the one variant an image shows", () => {
    expect(
      suggestedAlts({
        title: "  Keten   Gömlek ",
        images: [plain, { variantIds: ["var_1"] }, { variantIds: ["var_1", "var_2"] }],
        variantValues: new Map([["var_1", ["Beyaz", " M "]]]),
      })
    ).toEqual(["Keten Gömlek", "Keten Gömlek – Beyaz / M", "Keten Gömlek, görsel 2"])
  })

  it("tells alike images apart by their place, in the shop's language", () => {
    const source = { title: "Kupa", images: [plain, plain, plain], variantValues: new Map() }
    expect(suggestedAlts(source)).toEqual(["Kupa", "Kupa, görsel 2", "Kupa, görsel 3"])
    expect(suggestedAlts(source, "en")).toEqual(["Kupa", "Kupa, image 2", "Kupa, image 3"])
  })

  it("keeps to the length the alt route takes, and gives up on unclean text", () => {
    const [long] = suggestedAlts({
      title: "a".repeat(400),
      images: [plain],
      variantValues: new Map(),
    })
    expect(long).toHaveLength(ALT_MAX)
    expect(
      suggestedAlts({ title: "Kupa\u0000", images: [plain], variantValues: new Map() })
    ).toEqual([null])
    expect(suggestedAlts({ title: "   ", images: [plain], variantValues: new Map() })).toEqual([
      null,
    ])
  })

  it("keeps the place on a long name, and a name's own symbols as they are", () => {
    const [, second] = suggestedAlts({
      title: "a".repeat(400),
      images: [plain, plain],
      variantValues: new Map(),
    })
    expect(second).toHaveLength(ALT_MAX)
    expect(second?.endsWith(", görsel 2")).toBe(true)
    expect(
      suggestedAlts({ title: "Kupa $& $' 2$", images: [plain, plain], variantValues: new Map() })
    ).toEqual(["Kupa $& $' 2$", "Kupa $& $' 2$, görsel 2"])
  })
})
