import { mixedWindow } from "../reviews-mixed"

const at = (day: number) => new Date(Date.UTC(2026, 10, day))

/** adr/0058 Ek 2026-11-27: the shop's and Google's reviews as one list, newest first, cut in pages. */
describe("the mixed reviews page", () => {
  const shop = [
    { id: "s1", at: at(20) },
    { id: "s2", at: at(15) },
    { id: "s3", at: at(10) },
  ]
  const google = [
    { id: "g1", at: at(18) },
    { id: "g2", at: at(15) },
    { id: "g3", at: at(2) },
  ]

  it("merges by date, the shop's first on the same moment", () => {
    expect(mixedWindow(shop, google, 0, 10)).toEqual({
      shop: ["s1", "s2", "s3"],
      google: ["g1", "g2", "g3"],
    })
    // s1 g1 s2 g2 | s3 g3
    expect(mixedWindow(shop, google, 0, 4)).toEqual({ shop: ["s1", "s2"], google: ["g1", "g2"] })
    expect(mixedWindow(shop, google, 2, 2)).toEqual({ shop: ["s2"], google: ["g2"] })
    expect(mixedWindow(shop, google, 4, 4)).toEqual({ shop: ["s3"], google: ["g3"] })
  })

  it("gives one source alone, and nothing past the end", () => {
    expect(mixedWindow([], google, 1, 5)).toEqual({ shop: [], google: ["g2", "g3"] })
    expect(mixedWindow(shop, [], 0, 2)).toEqual({ shop: ["s1", "s2"], google: [] })
    expect(mixedWindow(shop, google, 6, 20)).toEqual({ shop: [], google: [] })
  })

  it("reads dates given as strings as the database gives them", () => {
    expect(
      mixedWindow([{ id: "s", at: "2026-11-01T00:00:00Z" }], [{ id: "g", at: at(2) }], 0, 1)
    ).toEqual({ shop: [], google: ["g"] })
  })
})
