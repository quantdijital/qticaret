import { formatLira } from "../format"

describe("formatLira", () => {
  it.each([
    [1500, "1.500,00 TL"],
    [1499.9, "1.499,90 TL"],
    [0, "0,00 TL"],
    [1234567.5, "1.234.567,50 TL"],
  ])("writes %p lira as %p", (lira, expected) => {
    expect(formatLira(lira)).toBe(expected)
  })
})
