import { createHash } from "node:crypto"
import { isBreached, passwordProblem } from ".."
import { COMMON_PASSWORDS } from "../common"

// Throwaway values for these checks only
const LONG_ENOUGH = "mavi kuş sabah uçar"

describe("passwordProblem", () => {
  it("counts characters, not bytes: ten Turkish letters are ten", () => {
    expect(passwordProblem("ğüşıöçğüşı")).toBeNull()
    expect(passwordProblem("ğüşıöçğüş")).toBe("too_short")
    expect(passwordProblem("a".repeat(9) + "😀")).toBeNull()
    expect(passwordProblem(`${LONG_ENOUGH} ${"x".repeat(240)}`)).toBe("too_long")
    expect(passwordProblem(LONG_ENOUGH)).toBeNull()
  })

  it("refuses the ones people pick first, in any case", () => {
    expect(passwordProblem("Galatasaray1905")).toBe("common")
    expect(passwordProblem("ŞİFRE12345")).toBe("common")
    expect(passwordProblem("QWERTYUIOP")).toBe("common")
    expect(passwordProblem("zzzzzzzzzzzz")).toBe("common")
    expect(passwordProblem("3456789012")).toBe("common")
    expect(passwordProblem("8765432109")).toBe("common")
  })

  it("keeps the list to what length alone lets through", () => {
    const list = Array.from(COMMON_PASSWORDS)
    expect(list.filter((one) => passwordProblem(one) === "too_short")).toEqual([])
    expect(list.filter((one) => one !== one.toLocaleLowerCase("tr"))).toEqual([])
  })

  it("refuses the address's name inside, a short name not", () => {
    expect(passwordProblem("ayse.kaya-2024!", "Ayse.Kaya@example.com")).toBe("contains_email")
    expect(passwordProblem("ali gelir yarın sabah", "ali@example.com")).toBeNull()
    expect(passwordProblem(LONG_ENOUGH, null)).toBeNull()
  })
})

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
