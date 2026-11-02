import { randomBytes } from "node:crypto"
import { layoutPreview, previewToken } from "../../content/preview-token"
import { BYPASS_PATH, bypassOpens, bypassParts, bypassToken } from "../maintenance"

const key = randomBytes(32)
const NOW = new Date("2026-11-03T10:00:00Z")

const opens = (token: string, version: number, now = NOW, withKey = key) => {
  const parts = bypassParts(token, now)
  return parts !== null && bypassOpens(withKey, parts, version)
}

describe("maintenance bypass links", () => {
  it("open the dark shop at the version they were made for, for a week", () => {
    const { token, expires_at } = bypassToken(key, 4, NOW)

    expect(token).toMatch(/^mnb_[\w-]{16}\.[0-9a-z]+\.[\w-]{43}$/)
    expect(BYPASS_PATH).toBe("/bakim/gir")
    expect(opens(token, 4)).toBe(true)
    expect(expires_at.toISOString()).toBe("2026-11-10T10:00:00.000Z")
    expect(opens(token, 4, new Date("2026-11-10T09:59:59Z"))).toBe(true)
    expect(opens(token, 4, new Date("2026-11-10T10:00:00Z"))).toBe(false)
  })

  it("end once the section is saved again (off and on is two saves)", () => {
    const { token } = bypassToken(key, 4, NOW)
    expect(opens(token, 5)).toBe(false)
    expect(opens(token, 6)).toBe(false)
  })

  it("are each their own, and open nothing changed, foreign or malformed", () => {
    const first = bypassToken(key, 4, NOW).token
    const second = bypassToken(key, 4, NOW).token
    expect(first).not.toBe(second)

    const [id, expires, mac] = first.split(".")
    const later = (parseInt(expires ?? "0", 36) + 3600).toString(36)
    expect(opens(`${id ?? ""}.${later}.${mac ?? ""}`, 4)).toBe(false)
    expect(opens(`mnb_${"A".repeat(16)}.${expires ?? ""}.${mac ?? ""}`, 4)).toBe(false)
    expect(opens(first, 4, NOW, randomBytes(32))).toBe(false)
    expect(bypassParts("", NOW)).toBeNull()
    expect(bypassParts("mnb_x", NOW)).toBeNull()
    expect(bypassParts(`${first}x`, NOW)).toBeNull()
  })

  it("never take a preview link's token, nor give one", () => {
    const preview = previewToken(key, { id: "cnt_01ABC", updated_at: new Date(4) }, NOW).token
    const layout = layoutPreview.token(key, { id: "sfl_01ABC", updated_at: new Date(4) }, NOW).token
    expect(bypassParts(preview, NOW)).toBeNull()
    expect(bypassParts(layout, NOW)).toBeNull()
    expect(layoutPreview.parts(bypassToken(key, 4, NOW).token, NOW)).toBeNull()
  })
})
