import { generateKeyPairSync } from "node:crypto"
import { signDocument, verifyDocument } from "../document"
import { signerFromPrivateKey } from "../ed25519"

const signer = signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)
const stranger = signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)
const keys = (kid: string) => (kid === signer.kid ? signer.privateKey : undefined)

const PLAN = {
  tenant_id: "ten_01JTEST",
  serial: 3,
  status: "active",
  limits: { products: 100, staff: null },
}

describe("signed documents", () => {
  it("verifies a document signed by a known key, whatever its key order", () => {
    const signature = signDocument("plan", PLAN, signer)
    const reordered = {
      limits: { staff: null, products: 100 },
      status: "active",
      serial: 3,
      tenant_id: "ten_01JTEST",
    }

    expect(verifyDocument("plan", reordered, signature, keys)).toEqual({
      ok: true,
      kid: signer.kid,
    })
  })

  it.each([
    ["a changed field", { ...PLAN, status: "restricted" }],
    ["an added field", { ...PLAN, extra: true }],
    ["a changed nested value", { ...PLAN, limits: { products: 1000, staff: null } }],
  ])("refuses %s", (_case, document) => {
    expect(verifyDocument("plan", document, signDocument("plan", PLAN, signer), keys)).toEqual({
      ok: false,
      code: "signature.invalid",
    })
  })

  it("refuses a signature made for another purpose", () => {
    const signature = signDocument("support-grant", PLAN, signer)

    expect(verifyDocument("plan", PLAN, signature, keys)).toMatchObject({
      code: "signature.invalid",
    })
  })

  it("refuses an unknown kid and another key under a known kid", () => {
    expect(verifyDocument("plan", PLAN, signDocument("plan", PLAN, stranger), keys)).toEqual({
      ok: false,
      code: "signature.unknown_key",
    })
    const forged = signDocument("plan", PLAN, { kid: signer.kid, privateKey: stranger.privateKey })
    expect(verifyDocument("plan", PLAN, forged, keys)).toMatchObject({ code: "signature.invalid" })
  })

  it("answers malformed input without throwing", () => {
    const signature = signDocument("plan", PLAN, signer)

    expect(verifyDocument("plan", PLAN, { ...signature, signature: "short" }, keys)).toMatchObject({
      code: "signature.malformed",
    })
    expect(verifyDocument("plan", { a: Number.NaN }, signature, keys)).toMatchObject({
      code: "signature.malformed",
    })
    expect(verifyDocument("Not A Purpose", PLAN, signature, keys)).toMatchObject({
      code: "signature.malformed",
    })
  })
})
