import { describe, expect, it } from "vitest"
import { safeNext } from "../errors"

describe("safeNext", () => {
  it("keeps a path on the shop", () => {
    expect(safeNext("/hesap/siparisler")).toBe("/hesap/siparisler")
    expect(safeNext("/urun/a?variant=x")).toBe("/urun/a?variant=x")
  })

  it.each([
    "//evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/ /evil.example",
    "/\\evil.example",
    "https://evil.example",
    "evil.example",
    "/%2F/evil.example".replace("%2F", "/"),
    "",
  ])("drops %j", (next) => {
    expect(safeNext(next)).toBeNull()
  })
})
