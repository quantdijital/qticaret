import { receivedProblem, receivedWhole } from "../receive-return"

const asked = [
  { line_item_id: "ordli_a", quantity: 2 },
  { line_item_id: "ordli_b", quantity: 1 },
]

describe("receivedProblem (adr/0032)", () => {
  it("takes sound and damaged units of a line together up to what was asked", () => {
    expect(
      receivedProblem(
        asked,
        [{ line_item_id: "ordli_a", quantity: 1 }],
        [{ line_item_id: "ordli_a", quantity: 1 }]
      )
    ).toBeNull()
    expect(receivedProblem(asked, [], [{ line_item_id: "ordli_b", quantity: 1 }])).toBeNull()
  })

  it("refuses more than asked, a line not asked, a line twice in a list, or nothing", () => {
    const problem = "returns.items_invalid"
    expect(
      receivedProblem(
        asked,
        [{ line_item_id: "ordli_a", quantity: 2 }],
        [{ line_item_id: "ordli_a", quantity: 1 }]
      )
    ).toBe(problem)
    expect(receivedProblem(asked, [{ line_item_id: "ordli_c", quantity: 1 }], [])).toBe(problem)
    expect(
      receivedProblem(
        asked,
        [
          { line_item_id: "ordli_a", quantity: 1 },
          { line_item_id: "ordli_a", quantity: 1 },
        ],
        []
      )
    ).toBe(problem)
    expect(receivedProblem(asked, [], [])).toBe(problem)
  })

  it("counts refused units with the rest: alone they are something, never more than asked", () => {
    const one = (line_item_id: string, quantity: number) => [{ line_item_id, quantity }]
    // A sealed good opened: refused, nothing else came (adr/0032 Ek 2026-11-03)
    expect(receivedProblem(asked, [], [], one("ordli_b", 1))).toBeNull()
    expect(receivedProblem(asked, one("ordli_a", 1), [], one("ordli_a", 1))).toBeNull()
    expect(receivedProblem(asked, one("ordli_a", 2), [], one("ordli_a", 1))).toBe(
      "returns.items_invalid"
    )
    expect(receivedProblem(asked, [], [], [...one("ordli_b", 1), ...one("ordli_b", 1)])).toBe(
      "returns.items_invalid"
    )
  })
})

describe("receivedWhole (adr/0032 §6)", () => {
  it("is whole only when every unit asked came back, sound or damaged", () => {
    const one = (line_item_id: string, quantity: number) => [{ line_item_id, quantity }]
    expect(
      receivedWhole(asked, one("ordli_a", 1), [
        { line_item_id: "ordli_a", quantity: 1 },
        { line_item_id: "ordli_b", quantity: 1 },
      ])
    ).toBe(true)
    expect(receivedWhole(asked, one("ordli_a", 2), [])).toBe(false)
  })
})
