import { TEST_CUSTOMER_USAGE, parseTestCustomerArgs } from "../args"

// Made up for the test; no account has it
const PASSWORD = "Ç0k-uzun-deneme-şifresi"

describe("customer:test arguments", () => {
  it("takes an address and a password on a development or test database", () => {
    expect(parseTestCustomerArgs([" Ayse@Example.com ", PASSWORD], "development")).toEqual({
      email: "ayse@example.com",
      password: PASSWORD,
    })
    expect(parseTestCustomerArgs(["ayse@example.com", PASSWORD], "test").email).toBe(
      "ayse@example.com"
    )
  })

  it.each([undefined, "production", "staging", ""])("refuses NODE_ENV=%s", (nodeEnv) => {
    expect(() => parseTestCustomerArgs(["ayse@example.com", PASSWORD], nodeEnv)).toThrow(
      "development and test databases only"
    )
  })

  it.each([
    [[]],
    [["ayse@example.com"]],
    [["not-an-address", PASSWORD]],
    [["a@b.co", PASSWORD, "x"]],
  ])("shows how to call it for %j", (args) => {
    expect(() => parseTestCustomerArgs(args, "development")).toThrow(TEST_CUSTOMER_USAGE)
  })

  it("holds the password to the shop's policy, never repeating it", () => {
    let message = ""
    try {
      parseTestCustomerArgs(["ayse@example.com", "kisa1"], "development")
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toBe("customer:test: the password is refused (too_short)")
    expect(message).not.toContain("kisa1")
  })
})
