import { COMMON_PASSWORDS } from "../password/common"
import { passwordProblem } from "../password/policy"

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
