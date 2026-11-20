import { lostTies } from "../variant-images"

const RED = "https://cdn.example.com/kirmizi.webp"
const BLUE = "https://cdn.example.com/mavi.webp"
const NEW = "https://cdn.example.com/yeni.webp"

describe("variant ties kept when a run adds pictures (adr/0042 Ek 2026-11-20)", () => {
  const before = [
    { id: "img_1", url: RED, variants: [{ id: "var_red" }, { id: "var_red_l" }] },
    { id: "img_2", url: BLUE, variants: [{ id: "var_blue" }] },
  ]

  it("puts back every tie a rebuilt picture lost, by its address", () => {
    const after = [
      { id: "img_9", url: RED, variants: [] },
      { id: "img_8", url: BLUE, variants: null },
      { id: "img_7", url: NEW, variants: [] },
    ]
    expect(lostTies(before, after)).toEqual(
      new Map([
        ["img_9", ["var_red", "var_red_l"]],
        ["img_8", ["var_blue"]],
      ])
    )
  })

  it("adds nothing where the save kept the pictures and their ties", () => {
    expect(lostTies(before, [...before, { id: "img_7", url: NEW, variants: [] }])).toEqual(
      new Map()
    )
    expect(lostTies(before, [{ id: "img_1", url: RED, variants: [{ id: "var_red" }] }])).toEqual(
      new Map([["img_1", ["var_red_l"]]])
    )
  })
})
