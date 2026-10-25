import { createSingleFlight } from "../single-flight"

describe("createSingleFlight", () => {
  it("shares one running computation per key and runs again once it settles", async () => {
    const flight = createSingleFlight<number>()
    let runs = 0
    let release: (value: number) => void = () => undefined
    const run = () => {
      runs += 1
      return new Promise<number>((resolve) => {
        release = resolve
      })
    }

    const first = flight("a", run)
    const second = flight("a", run)
    const other = flight("b", () => Promise.resolve(7))
    release(1)

    expect(await Promise.all([first, second, other])).toEqual([1, 1, 7])
    expect(runs).toBe(1)
    expect(await flight("a", () => Promise.resolve(3))).toBe(3)
  })

  it("lets the next caller retry after a failure", async () => {
    const flight = createSingleFlight<number>()

    await expect(flight("a", () => Promise.reject(new Error("down")))).rejects.toThrow("down")
    expect(await flight("a", () => Promise.resolve(4))).toBe(4)
  })
})
