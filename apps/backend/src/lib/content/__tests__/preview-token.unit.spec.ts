import { randomBytes } from "node:crypto"
import { previewOpens, previewToken, previewTokenParts, productPreview } from "../preview-token"

const key = randomBytes(32)
const NOW = new Date("2026-11-02T10:00:00Z")
const entry = { id: "cnt_01ABC", updated_at: new Date("2026-11-02T09:00:00Z") }

const opens = (token: string, savedAt: Date, now = NOW, withKey = key) => {
  const parts = previewTokenParts(token, now)
  return parts !== null && parts.entryId === entry.id && previewOpens(withKey, parts, savedAt)
}

describe("preview tokens", () => {
  it("opens its own entry, as saved when made, for a day", () => {
    const { token, expires_at } = previewToken(key, entry, NOW)
    expect(opens(token, entry.updated_at)).toBe(true)
    expect(expires_at.toISOString()).toBe("2026-11-03T10:00:00.000Z")
    expect(opens(token, entry.updated_at, new Date("2026-11-03T10:00:00Z"))).toBe(false)
  })

  it("stops opening once the entry is saved again", () => {
    const { token } = previewToken(key, entry, NOW)
    expect(opens(token, new Date("2026-11-02T09:30:00Z"))).toBe(false)
  })

  it("opens nothing changed, foreign or malformed", () => {
    const { token } = previewToken(key, entry, NOW)
    const [, expires, mac] = token.split(".")
    const other = previewTokenParts(`cnt_01ABD.${expires ?? ""}.${mac ?? ""}`, NOW)
    expect(other && previewOpens(key, other, entry.updated_at)).toBe(false)
    expect(opens(token, entry.updated_at, NOW, randomBytes(32))).toBe(false)
    expect(previewTokenParts("cnt_01ABC", NOW)).toBeNull()
    expect(previewTokenParts(`prod_01.${expires ?? ""}.${mac ?? ""}`, NOW)).toBeNull()
  })
})

describe("a draft product's preview tokens (F18)", () => {
  const product = { id: "prod_01JABCDEF", updated_at: new Date("2026-11-06T09:00:00Z") }

  it("opens the product as saved when made, for a day, and nothing after a save", () => {
    const { token, expires_at } = productPreview.token(key, product, NOW)
    const parts = productPreview.parts(token, NOW)
    expect(parts?.entryId).toBe(product.id)
    expect(parts && productPreview.opens(key, parts, product.updated_at)).toBe(true)
    expect(expires_at.toISOString()).toBe("2026-11-03T10:00:00.000Z")
    expect(parts && productPreview.opens(key, parts, new Date("2026-11-06T09:05:00Z"))).toBe(false)
    expect(productPreview.parts(token, new Date("2026-11-03T10:00:01Z"))).toBeNull()
  })

  it("is not a content entry's link, nor the other way round", () => {
    const { token } = productPreview.token(key, product, NOW)
    const [, expires, mac] = token.split(".")
    const asContent = previewTokenParts(`cnt_01JABCDEF.${expires ?? ""}.${mac ?? ""}`, NOW)
    expect(asContent && previewOpens(key, asContent, product.updated_at)).toBe(false)
    const content = previewToken(key, entry, NOW).token
    expect(productPreview.parts(content, NOW)).toBeNull()
  })
})
