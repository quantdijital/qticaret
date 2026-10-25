import { storeNameArg } from "../store-name"

describe("storeNameArg", () => {
  it("reads store-name=, trimmed", () => {
    expect(storeNameArg(["store-name=Bıçak Dünyası"])).toBe("Bıçak Dünyası")
    expect(storeNameArg(["other", "store-name=  Çatal & Kaşık  "])).toBe("Çatal & Kaşık")
  })

  it("is undefined when not given", () => {
    expect(storeNameArg([])).toBeUndefined()
    expect(storeNameArg(["allow-non-local"])).toBeUndefined()
  })

  it.each([
    ["an empty name", ["store-name="]],
    ["a name over 120 characters", [`store-name=${"a".repeat(121)}`]],
    ["a control character", ["store-name=Bıçak\u0007"]],
    ["a direction override", ["store-name=Bıçak\u202Eİ"]],
    ["a name that looks like a flag", ["store-name=--allow-non-local"]],
  ])("refuses %s", (_label, args) => {
    expect(() => storeNameArg(args)).toThrow("store-name")
  })
})
