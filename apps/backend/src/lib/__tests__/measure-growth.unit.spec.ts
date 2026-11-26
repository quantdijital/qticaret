import { measureGrowth } from "@qticaret/testing"

// `@qticaret/testing`'s growth check, which the hostile input tests lean on
// (adr/0081): it must still tell linear work (eight times the input, about
// eight times as long) from quadratic work (about sixty-four times).

/** Linear work that leaves garbage behind, as a parser building strings does. */
const linearWithGarbage = (size: number) => {
  const text = "<a".repeat(size)
  return () => text.split("").join("|").length
}

/**
 * Quadratic work, as a careless duplicate check: each item looked up in the
 * whole list. The inner scan is the engine's own, so its speed does not
 * depend on how warm the compiler is.
 */
const quadratic = (size: number) => {
  const items = Array.from({ length: size }, (_, index) => index)
  return () => items.filter((item) => items.includes(-item - 1)).length
}

describe("measureGrowth", () => {
  it("takes garbage-heavy linear work as linear", () => {
    const growth = measureGrowth(linearWithGarbage, 62_500)
    expect(growth).toMatchObject({ linear: true })
  })

  it("takes quadratic work as not linear", () => {
    // Quadratic work reads as linear only when a busy machine slowed every small run
    // (CI run 45710669339; it measures about 62 against 22.6 here): a few tries, not one
    let growth = measureGrowth(quadratic, 2_000, { rounds: 3 })
    for (let attempt = 1; attempt < 3 && growth.linear; attempt++) {
      growth = measureGrowth(quadratic, 2_000, { rounds: 3 })
    }
    expect(growth.largeMs).toBeGreaterThan(20)
    expect(growth).toMatchObject({ linear: false })
    expect(growth.ratio).toBeGreaterThan(growth.limit)
  })
})
