import { storeNameArg } from "../store-name"

describe("storeNameArg", () => {
  it("reads the flag in both forms, trimmed", () => {
    expect(storeNameArg(["--store-name=Bıçak Dünyası"])).toBe("Bıçak Dünyası")
    expect(storeNameArg(["--store-name", "  Çatal & Kaşık  "])).toBe("Çatal & Kaşık")
  })

  it("is undefined when the flag is not given", () => {
    expect(storeNameArg([])).toBeUndefined()
    expect(storeNameArg(["--allow-non-local"])).toBeUndefined()
  })

  it.each([
    ["an empty name", ["--store-name="]],
    ["a flag without a value", ["--store-name"]],
    ["a name over 120 characters", [`--store-name=${"a".repeat(121)}`]],
    ["a control character", ["--store-name=Bıçak\u0007"]],
    ["a direction override", ["--store-name=Bıçak\u202Eİ"]],
    ["the next flag", ["--store-name", "--allow-non-local"]],
  ])("refuses %s", (_label, args) => {
    expect(() => storeNameArg(args)).toThrow("--store-name")
  })
})
