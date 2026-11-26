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

  it("measures again when one measurement is slowed, as a busy runner does", () => {
    // The large run is held up through the warm-up and the first attempt
    // (three rounds), then runs as fast as the small one
    let held = 4
    const busy = (ms: number) => {
      const until = performance.now() + ms
      while (performance.now() < until) {
        // wait
      }
    }
    const work = (size: number) => () => {
      if (size > 1 && held > 0) {
        held--
        busy(60)
      } else {
        busy(2)
      }
    }
    expect(measureGrowth(work, 1, { rounds: 3, attempts: 1 })).toMatchObject({ linear: false })
    held = 4
    expect(measureGrowth(work, 1, { rounds: 3 })).toMatchObject({ linear: true })
  })

  it("takes quadratic work as not linear", () => {
    const growth = measureGrowth(quadratic, 2_000, { rounds: 3 })
    expect(growth.largeMs).toBeGreaterThan(20)
    expect(growth).toMatchObject({ linear: false })
    expect(growth.ratio).toBeGreaterThan(growth.limit)
  })
})
