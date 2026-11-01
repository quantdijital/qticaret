import { randomBytes } from "node:crypto"
import { previewEntryOf, previewToken } from "../preview-token"

const key = randomBytes(32)
const NOW = new Date("2026-11-02T10:00:00Z")

describe("preview tokens", () => {
  it("opens its own entry for a day", () => {
    const { token, expires_at } = previewToken(key, "cnt_01ABC", NOW)
    expect(previewEntryOf(key, token, NOW)).toBe("cnt_01ABC")
    expect(expires_at.toISOString()).toBe("2026-11-03T10:00:00.000Z")
    expect(previewEntryOf(key, token, new Date("2026-11-03T10:00:00Z"))).toBeNull()
  })

  it("opens nothing changed, foreign or malformed", () => {
    const { token } = previewToken(key, "cnt_01ABC", NOW)
    const [, expires, mac] = token.split(".")
    expect(previewEntryOf(key, `cnt_01ABD.${expires ?? ""}.${mac ?? ""}`, NOW)).toBeNull()
    expect(previewEntryOf(randomBytes(32), token, NOW)).toBeNull()
    expect(previewEntryOf(key, "cnt_01ABC", NOW)).toBeNull()
    expect(previewEntryOf(key, `prod_01.${expires ?? ""}.${mac ?? ""}`, NOW)).toBeNull()
  })
})
