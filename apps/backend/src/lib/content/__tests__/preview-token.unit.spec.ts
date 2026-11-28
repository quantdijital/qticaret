import { randomBytes } from "node:crypto"
import {
  designPreview,
  layoutPreview,
  previewOpens,
  previewToken,
  previewTokenParts,
  productPreview,
} from "../preview-token"

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

describe("a saved look's preview tokens (adr/0064)", () => {
  const design = { id: "sfd_01JLOOK", updated_at: new Date("2026-11-02T08:00:00Z") }

  it("opens the look as saved when made, for an hour, and nothing after a rename", () => {
    const { token, expires_at } = designPreview.token(key, design, NOW)
    const parts = designPreview.parts(token, NOW)
    expect(parts?.entryId).toBe(design.id)
    expect(parts && designPreview.opens(key, parts, design.updated_at)).toBe(true)
    expect(expires_at.toISOString()).toBe("2026-11-02T11:00:00.000Z")
    expect(designPreview.parts(token, new Date("2026-11-02T11:00:00Z"))).toBeNull()
    expect(parts && designPreview.opens(key, parts, new Date("2026-11-02T10:30:00Z"))).toBe(false)
  })

  it("opens no other look, and is never the draft's design link nor the other way round", () => {
    const { token } = designPreview.token(key, design, NOW)
    const [, expires, mac] = token.split(".")
    const other = designPreview.parts(`sfd_01JOTHER.${expires ?? ""}.${mac ?? ""}`, NOW)
    expect(other && designPreview.opens(key, other, design.updated_at)).toBe(false)
    expect(layoutPreview.parts(token, NOW)).toBeNull()
    const draft = layoutPreview.token(key, { id: "sfl_01JDRAFT", updated_at: NOW }, NOW).token
    expect(designPreview.parts(draft, NOW)).toBeNull()
    // The same id under the draft link's context: another MAC
    const [, dExpires, dMac] = layoutPreview
      .token(key, { id: "sfl_01JLOOK", updated_at: design.updated_at }, NOW)
      .token.split(".")
    const forged = designPreview.parts(`sfd_01JLOOK.${dExpires ?? ""}.${dMac ?? ""}`, NOW)
    expect(forged && designPreview.opens(key, forged, design.updated_at)).toBe(false)
  })
})
