import { eachBounded } from "../bounded"

describe("eachBounded (C9 review L7)", () => {
  it("does every item, never more than the limit at once", async () => {
    let running = 0
    let peak = 0
    const done: number[] = []
    await eachBounded([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (item) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      done.push(item)
      running -= 1
    })

    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(peak).toBe(4)
  })

  it("does nothing for no items", async () => {
    const work = jest.fn(() => Promise.resolve())
    await eachBounded([], 4, work)
    expect(work).not.toHaveBeenCalled()
  })
})
