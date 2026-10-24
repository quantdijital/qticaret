import { requireEnv } from "../env"

describe("requireEnv", () => {
  const name = "QT_TEST_REQUIRED_VAR"

  afterEach(() => {
    Reflect.deleteProperty(process.env, name)
  })

  it("returns the value when set", () => {
    process.env[name] = "value"
    expect(requireEnv(name)).toBe("value")
  })

  it.each([undefined, "", "   "])("throws when the value is %p", (value) => {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name)
    } else {
      process.env[name] = value
    }
    expect(() => requireEnv(name)).toThrow(`Missing required environment variable: ${name}`)
  })
})
