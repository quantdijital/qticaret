import { describe, expect, it } from "vitest"
import { takeLinkToken, tokenOfHash } from "./link-token"

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Imludl8xIn0.c2lnbmF0dXJl"

describe("a link's token (after `#`)", () => {
  it("reads an invitation's signed token and a base64url one", () => {
    expect(tokenOfHash(`#token=${TOKEN}`)).toBe(TOKEN)
    expect(tokenOfHash("#token=AbCdEfGhIjKlMnOpQrStUv_-")).toBe("AbCdEfGhIjKlMnOpQrStUv_-")
  })

  it("refuses a missing or malformed one", () => {
    expect(tokenOfHash("")).toBeNull()
    expect(tokenOfHash("#token=short")).toBeNull()
    expect(tokenOfHash("#token=<script>alert(1)</script>xxxxxxxx")).toBeNull()
  })

  it("takes it out of the address bar once read, and gives it again on the same page", () => {
    window.history.replaceState(null, "", `/invite#token=${TOKEN}`)

    expect(takeLinkToken()).toBe(TOKEN)
    expect(window.location.hash).toBe("")
    expect(window.location.pathname).toBe("/invite")
    expect(takeLinkToken()).toBe(TOKEN)

    window.history.replaceState(null, "", "/login")
    expect(takeLinkToken()).toBeNull()
  })
})
