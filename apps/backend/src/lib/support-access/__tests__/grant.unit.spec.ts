import { generateKeyPairSync } from "node:crypto"
import { privateKeyFromSeed, signDocument, signerFromPrivateKey } from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { PLAN_DOCUMENT_PURPOSE, SUPPORT_GRANT_PURPOSE } from "@qticaret/types/control-plane"
import type { SupportGrantDocument } from "@qticaret/types/control-plane"
import { TENANT_ID, TEST_ONLY_CP_SEED } from "@qticaret/types/control-plane/testing"
import { checkSupportGrant, decodeGrant } from "../grant"

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const publicKeys = new Map([[cp.kid, cp.privateKey]])
const NOW = 1_795_000_000

const grant = (over: Partial<SupportGrantDocument> = {}): SupportGrantDocument => ({
  version: 1,
  audience: "shop_panel",
  tenant_id: TENANT_ID,
  grant_id: "sgr_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX",
  operator: { id: "user_01OPERATOR", name: "Ayşe Yılmaz", role: "operator" },
  reason: "Ana sayfa görünümünü birlikte kurmak için",
  issued_at: NOW,
  expires_at: NOW + 30 * 60,
  ...over,
})

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")

const signed = (
  document: SupportGrantDocument,
  signer: Ed25519Signer = cp,
  purpose = SUPPORT_GRANT_PURPOSE
) => encode({ document, ...signDocument(purpose, document, signer) })

const check = (encoded: unknown, now = NOW, tenantId: string | null = TENANT_ID) =>
  checkSupportGrant(encoded, { publicKeys, tenantId, now })

describe("checkSupportGrant (adr/0061 Ek Destek erişimi, Karar 3)", () => {
  it("accepts a fresh grant for this shop's panel", () => {
    expect(check(signed(grant()))).toMatchObject({ ok: true, grant: { tenant_id: TENANT_ID } })
  })

  it("refuses what is not a grant: garbage, a bad encoding, an unknown field", () => {
    expect(check("not base64url!")).toEqual({ ok: false, code: "support.grant_invalid" })
    expect(check(encode({ hello: 1 }))).toEqual({ ok: false, code: "support.grant_invalid" })
    const extra = { ...grant(), admin: true } as SupportGrantDocument
    expect(check(signed(extra))).toEqual({ ok: false, code: "support.grant_invalid" })
    expect(decodeGrant("x".repeat(5000))).toBeNull()
  })

  it("refuses a grant lasting past an hour, even signed", () => {
    expect(check(signed(grant({ expires_at: NOW + 61 * 60 })))).toEqual({
      ok: false,
      code: "support.grant_invalid",
    })
  })

  it("refuses another key under the control plane's kid, and a key it was not given", () => {
    const stranger = signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)
    const forged = JSON.parse(Buffer.from(signed(grant(), stranger), "base64url").toString()) as {
      kid: string
    }
    expect(check(encode({ ...forged, kid: cp.kid }))).toEqual({
      ok: false,
      code: "signature.invalid",
    })
    expect(check(signed(grant(), stranger))).toEqual({ ok: false, code: "signature.unknown_key" })
  })

  it("refuses a grant changed after signing (a longer session, another reason)", () => {
    const wire = JSON.parse(Buffer.from(signed(grant()), "base64url").toString()) as {
      document: SupportGrantDocument
    }
    wire.document.reason = "Müşteri listesini dışa aktarmak için"
    expect(check(encode(wire))).toEqual({ ok: false, code: "signature.invalid" })
  })

  it("refuses a signature made for another purpose (a plan document's)", () => {
    expect(check(signed(grant(), cp, PLAN_DOCUMENT_PURPOSE))).toEqual({
      ok: false,
      code: "signature.invalid",
    })
  })

  it("refuses another shop's grant, and any grant while this shop has no id", () => {
    expect(check(signed(grant({ tenant_id: "ten_01OTHERSHOP" })))).toEqual({
      ok: false,
      code: "support.wrong_tenant",
    })
    expect(check(signed(grant()), NOW, null)).toEqual({ ok: false, code: "support.wrong_tenant" })
  })

  it("holds the audience: only a shop panel grant passes the schema", () => {
    const other = { ...grant(), audience: "storefront" } as unknown as SupportGrantDocument
    expect(check(signed(other))).toEqual({ ok: false, code: "support.grant_invalid" })
  })

  it("refuses a grant redeemed late, past its end, or from too far in the future", () => {
    expect(check(signed(grant()), NOW + 5 * 60 + 1)).toEqual({
      ok: false,
      code: "support.grant_expired",
    })
    expect(check(signed(grant({ expires_at: NOW + 60 })), NOW + 60)).toEqual({
      ok: false,
      code: "support.grant_expired",
    })
    expect(check(signed(grant()), NOW - 5 * 60 - 1)).toEqual({
      ok: false,
      code: "support.grant_expired",
    })
    // Within the skew either side it passes
    expect(check(signed(grant()), NOW - 5 * 60)).toMatchObject({ ok: true })
  })
})
