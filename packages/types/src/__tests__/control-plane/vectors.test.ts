import { createHash, createPublicKey, verify } from "node:crypto"
import {
  DEFAULT_MAX_SKEW_SECONDS,
  DEFAULT_NONCE_TTL_SECONDS,
  MemoryNonceStore,
  bodyDigest,
  privateKeyFromSeed,
  signDocument,
  signRequest,
  signerFromPrivateKey,
  verifyDocument,
  verifySignedRequest,
} from "@qticaret/server-kit"
import { describe, expect, it } from "vitest"
import {
  PLAN_DOCUMENT_PURPOSE,
  signedPlanDocumentSchema,
} from "../../control-plane/plan-document.js"
import {
  SIGNED_REQUEST_HEADERS,
  SIGNED_REQUEST_MAX_SKEW_SECONDS,
  SIGNED_REQUEST_NONCE_TTL_SECONDS,
  signedRequestHeadersSchema,
} from "../../control-plane/signature.js"
import { usageReportSchema } from "../../control-plane/usage-report.js"
import {
  FIXED_NONCE,
  FIXED_NOW,
  TENANT_ID,
  TEST_ONLY_CP_SEED,
  TEST_ONLY_TENANT_SEED,
  planDocument,
  usageReport,
} from "./fixtures.js"

// Fixed vectors: Ed25519 is deterministic, so the same key, document, time
// and nonce always give these values. A change here changes the wire format.
const CP_KID = "8ef1b5e037c46d50"
const TENANT_KID = "957e1bd0f0d4920c"
const PLAN_SIGNATURE =
  "4bFsaf_yZv4DHBIguglbltruHb3xpdf4yX_Bnz-bMAv1x3igKusDQs_ifOG7Sx8vsZZ1uHoMh9mOSyqld92VDg"
const USAGE_BODY_DIGEST = "1nFBl6GUrtixTICLOwRkyiAC34Nx4-mdXxpNhxoTYzk"
const USAGE_SIGNATURE =
  "eGjctB2ZqkbHpUK0pk9WMdIyc8Ilr9oEtPJ0XJaYjLGX9MLwXPexDsTg_AfrdXTEnW1SfweX2yQjn50z0VpDBg"

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const tenant = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
const USAGE_PATH = "/tenant-api/v1/usage"

describe("plan document vector", () => {
  it("signs to the fixed signature under the fixed key", () => {
    expect(cp.kid).toBe(CP_KID)
    expect(signDocument(PLAN_DOCUMENT_PURPOSE, planDocument, cp)).toEqual({
      kid: CP_KID,
      signature: PLAN_SIGNATURE,
    })
  })

  it("verifies after the wire: JSON text, parsed by the strict schema", () => {
    const wire = JSON.stringify({ document: planDocument, kid: CP_KID, signature: PLAN_SIGNATURE })
    const signed = signedPlanDocumentSchema.parse(JSON.parse(wire))

    const keys = (kid: string) => (kid === cp.kid ? cp.privateKey : undefined)
    expect(verifyDocument(PLAN_DOCUMENT_PURPOSE, signed.document, signed, keys)).toEqual({
      ok: true,
      kid: CP_KID,
    })
    expect(
      verifyDocument(PLAN_DOCUMENT_PURPOSE, { ...signed.document, serial: 8 }, signed, keys)
    ).toEqual({ ok: false, code: "signature.invalid" })
  })
})

describe("wire format, checked with node:crypto alone", () => {
  const publicKey = (seed: Buffer) => createPublicKey(privateKeyFromSeed(seed))

  it("is Ed25519 over the purpose and the sorted JSON of the plan document", () => {
    const message = [
      "QT-ED25519-DOC-V1",
      "plan",
      '{"billing":{"amount":149900,"currency":"TRY","due_on":"2026-12-01","grace_ends_on":null,' +
        '"status":"active"},"issued_at":"2026-11-10T09:00:00.000Z","limits":{"custom_domains":1,' +
        '"llm_credits_per_month":100,"orders_per_month":null,"products":500,"staff":3,' +
        '"storage_mb":2048},"package_code":"standart","platform_flags":{"test.platform_sample":true},' +
        `"serial":7,"status":"active","tenant_id":"${TENANT_ID}","version":1}`,
    ].join("\n")

    expect(
      verify(
        null,
        Buffer.from(message),
        publicKey(TEST_ONLY_CP_SEED),
        Buffer.from(PLAN_SIGNATURE, "base64url")
      )
    ).toBe(true)
  })

  it("is Ed25519 over the request's lines", () => {
    const message = [
      "QT-ED25519-V1",
      "POST",
      USAGE_PATH,
      TENANT_ID,
      "1794301200",
      FIXED_NONCE,
      TENANT_KID,
      createHash("sha256").update(JSON.stringify(usageReport)).digest("base64url"),
    ].join("\n")

    expect(
      verify(
        null,
        Buffer.from(message),
        publicKey(TEST_ONLY_TENANT_SEED),
        Buffer.from(USAGE_SIGNATURE, "base64url")
      )
    ).toBe(true)
  })
})

describe("usage report vector", () => {
  const body = JSON.stringify(usageReport)
  const sign = () =>
    signRequest({
      method: "POST",
      path: USAGE_PATH,
      tenantId: TENANT_ID,
      body,
      signer: tenant,
      now: FIXED_NOW,
      nonce: FIXED_NONCE,
    })

  it("signs to the fixed headers", () => {
    expect(tenant.kid).toBe(TENANT_KID)
    expect(bodyDigest(body)).toBe(USAGE_BODY_DIGEST)
    expect(sign()).toEqual({
      [SIGNED_REQUEST_HEADERS.tenant]: TENANT_ID,
      [SIGNED_REQUEST_HEADERS.keyId]: TENANT_KID,
      [SIGNED_REQUEST_HEADERS.timestamp]: String(FIXED_NOW / 1000),
      [SIGNED_REQUEST_HEADERS.nonce]: FIXED_NONCE,
      [SIGNED_REQUEST_HEADERS.signature]: USAGE_SIGNATURE,
    })
    expect(signedRequestHeadersSchema.safeParse(sign()).success).toBe(true)
  })

  it("verifies once, refuses the replay, and the body passes the strict schema", async () => {
    const nonces = new MemoryNonceStore(() => FIXED_NOW)
    const options = {
      publicKey: (kid: string, tenantId: string) =>
        kid === tenant.kid && tenantId === TENANT_ID ? tenant.privateKey : undefined,
      nonces,
      now: () => FIXED_NOW,
    }
    const request = { method: "POST", path: USAGE_PATH, headers: sign(), body }

    expect(await verifySignedRequest(request, options)).toMatchObject({ ok: true })
    expect(await verifySignedRequest(request, options)).toEqual({
      ok: false,
      code: "signature.replayed",
    })
    expect(usageReportSchema.parse(JSON.parse(body))).toEqual(usageReport)
  })

  it("refuses the same request ten minutes later", async () => {
    const later = FIXED_NOW + 10 * 60 * 1000
    const result = await verifySignedRequest(
      { method: "POST", path: USAGE_PATH, headers: sign(), body },
      {
        publicKey: () => tenant.privateKey,
        nonces: new MemoryNonceStore(() => later),
        now: () => later,
      }
    )

    expect(result).toEqual({ ok: false, code: "signature.stale" })
  })
})

describe("the nonce window (C9 review L2)", () => {
  it("outlasts every timestamp still accepted, on both sides alike", () => {
    expect(SIGNED_REQUEST_NONCE_TTL_SECONDS).toBe(DEFAULT_NONCE_TTL_SECONDS)
    expect(SIGNED_REQUEST_MAX_SKEW_SECONDS).toBe(DEFAULT_MAX_SKEW_SECONDS)
    expect(SIGNED_REQUEST_NONCE_TTL_SECONDS).toBeGreaterThanOrEqual(
      2 * SIGNED_REQUEST_MAX_SKEW_SECONDS + 2
    )
  })
})
