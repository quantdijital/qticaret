import { createHash } from "node:crypto"
import { isBreached } from ".."

// Throwaway values for these checks only
const LONG_ENOUGH = "mavi kuş sabah uçar"

describe("isBreached", () => {
  const digest = createHash("sha1").update(LONG_ENOUGH, "utf8").digest("hex").toUpperCase()

  it("sends the hash's first five characters only, and matches the rest here", async () => {
    const asked: string[] = []
    const breached = await isBreached(LONG_ENOUGH, (prefix) => {
      asked.push(prefix)
      return Promise.resolve(`0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${digest.slice(5)}:12\r\n`)
    })
    expect(asked).toEqual([digest.slice(0, 5)])
    expect(breached).toBe(true)
  })

  it("takes a padding line (count 0) and an unknown suffix as not breached", async () => {
    expect(await isBreached(LONG_ENOUGH, () => Promise.resolve(`${digest.slice(5)}:0\r\n`))).toBe(
      false
    )
    expect(await isBreached(LONG_ENOUGH, () => Promise.resolve("ABC:1\r\n"))).toBe(false)
  })

  it("answers null when the list cannot be asked", async () => {
    expect(await isBreached(LONG_ENOUGH, () => Promise.reject(new Error("down")))).toBeNull()
  })
})
