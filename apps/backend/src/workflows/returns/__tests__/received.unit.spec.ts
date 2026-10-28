import { receivedProblem } from "../receive-return"

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
})
