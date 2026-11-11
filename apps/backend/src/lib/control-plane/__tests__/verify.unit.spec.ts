import { generateKeyPairSync } from "node:crypto"
import {
  privateKeyFromSeed,
  rawPublicKey,
  signDocument,
  signerFromPrivateKey,
} from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { PLAN_DOCUMENT_PURPOSE } from "@qticaret/types/control-plane"
import type { PlanDocument } from "@qticaret/types/control-plane"
import {
  PLAN_VECTOR,
  TENANT_ID,
  TEST_ONLY_CP_SEED,
  planDocument,
} from "@qticaret/types/control-plane/testing"
import { controlPlaneConfig } from "../config"
import { checkPlanDocument } from "../verify"

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const publicKeys = new Map([[cp.kid, cp.privateKey]])
const options = { publicKeys, tenantId: TENANT_ID }

const signed = (document: PlanDocument, signer: Ed25519Signer = cp) => ({
  document,
  ...signDocument(PLAN_DOCUMENT_PURPOSE, document, signer),
})

const stranger = () => signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)

describe("checkPlanDocument (adr/0061 §3.2, Ek C9)", () => {
  it("accepts the contract's vector as it travels: JSON text, the fixed signature", () => {
    const wire = JSON.parse(JSON.stringify({ document: planDocument, ...PLAN_VECTOR })) as unknown

    expect(checkPlanDocument(wire, options)).toMatchObject({ ok: true })
  })

  it("refuses a forged signature: another key under the control plane's kid", () => {
    const forged = { ...signed(planDocument, stranger()), kid: cp.kid }

    expect(checkPlanDocument(forged, options)).toEqual({ ok: false, code: "signature.invalid" })
  })

  it("refuses a document changed after it was signed", () => {
    const changed = { ...PLAN_VECTOR, document: { ...planDocument, status: "active", serial: 8 } }

    expect(checkPlanDocument(changed, options)).toEqual({ ok: false, code: "signature.invalid" })
  })

  it("refuses a key it was not given", () => {
    expect(checkPlanDocument(signed(planDocument, stranger()), options)).toEqual({
      ok: false,
      code: "signature.unknown_key",
    })
  })

  it("refuses another shop's document, even signed by the control plane", () => {
    const other = signed({ ...planDocument, tenant_id: "ten_01JOTHERSHOP0000000000000" })

    expect(checkPlanDocument(other, options)).toEqual({
      ok: false,
      code: "control_plane.wrong_tenant",
    })
    expect(checkPlanDocument(signed(planDocument), { publicKeys, tenantId: null })).toEqual({
      ok: false,
      code: "control_plane.wrong_tenant",
    })
  })

  it.each([
    ["an unknown field in the document", { ...planDocument, extra: true }],
    ["an unknown version", { ...planDocument, version: 2 }],
    ["a missing limit", { ...planDocument, limits: { products: 1 } }],
    ["a flag that is not a flag key", { ...planDocument, platform_flags: { Bad: true } }],
  ])("refuses %s by its shape", (_, document) => {
    const body = { document, ...signDocument(PLAN_DOCUMENT_PURPOSE, document, cp) }

    expect(checkPlanDocument(body, options)).toEqual({
      ok: false,
      code: "control_plane.document_invalid",
    })
  })

  it("refuses an unknown field beside the document, and anything that is not one", () => {
    expect(checkPlanDocument({ ...signed(planDocument), note: "x" }, options)).toMatchObject({
      code: "control_plane.document_invalid",
    })
    for (const raw of [null, "text", [], 7, {}]) {
      expect(checkPlanDocument(raw, options)).toMatchObject({ ok: false })
    }
  })
})

describe("controlPlaneConfig (adr/0061 §3.3)", () => {
  it("is unmanaged without public keys, whatever else is set", () => {
    expect(controlPlaneConfig({ TENANT_ID, CONTROL_PLANE_URL: "http://cp:9100" })).toMatchObject({
      managed: false,
      tenantId: null,
    })
  })

  it("is managed with the keys, by key id", () => {
    const config = controlPlaneConfig({
      CONTROL_PLANE_PUBLIC_KEYS: rawPublicKey(cp.privateKey).toString("base64url"),
      TENANT_ID,
      CONTROL_PLANE_URL: "http://control-plane:9100/",
    })

    expect(config.managed).toBe(true)
    expect([...config.publicKeys.keys()]).toEqual([cp.kid])
    expect(config.url).toBe("http://control-plane:9100")
  })
})
