import { generateKeyPairSync } from "node:crypto"
import { MemoryNonceStore } from "../nonce-store"
import { SIGNED_REQUEST_HEADERS, signRequest, verifySignedRequest } from "../request"
import type { IncomingSignedRequest, VerifyRequestOptions } from "../request"
import { signerFromPrivateKey } from "../ed25519"

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0)
const TENANT = "ten_01JTEST"
const PATH = "/tenant-api/v1/usage"
const BODY = '{"products":12,"orders_this_month":3}'

const signer = signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)
const stranger = signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)

function setup(now = NOW) {
  const nonces = new MemoryNonceStore(() => now)
  const options: VerifyRequestOptions = {
    publicKey: (kid, tenantId) =>
      kid === signer.kid && tenantId === TENANT ? signer.privateKey : undefined,
    nonces,
    now: () => now,
  }
  return options
}

function signed(overrides: Partial<Parameters<typeof signRequest>[0]> = {}): IncomingSignedRequest {
  const headers = signRequest({
    method: "post",
    path: PATH,
    tenantId: TENANT,
    body: BODY,
    signer,
    now: NOW,
    ...overrides,
  })
  return { method: "POST", path: PATH, headers, body: BODY }
}

describe("signed requests", () => {
  it("accepts a request signed by the tenant's key", async () => {
    const result = await verifySignedRequest(signed(), setup())

    expect(result).toEqual({
      ok: true,
      tenantId: TENANT,
      kid: signer.kid,
      timestamp: Math.floor(NOW / 1000),
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/) as string,
    })
  })

  it("accepts the body as bytes as well as text", async () => {
    const request = { ...signed(), body: Buffer.from(BODY) }

    expect(await verifySignedRequest(request, setup())).toMatchObject({ ok: true })
  })

  it("refuses a replayed nonce", async () => {
    const options = setup()
    const request = signed()

    expect(await verifySignedRequest(request, options)).toMatchObject({ ok: true })
    expect(await verifySignedRequest(request, options)).toEqual({
      ok: false,
      code: "signature.replayed",
    })
  })

  it("forgets a nonce only after its timestamp is no longer accepted", async () => {
    let now = NOW
    const nonces = new MemoryNonceStore(() => now)
    const options = { ...setup(), nonces, now: () => now }
    const request = signed()

    expect(await verifySignedRequest(request, options)).toMatchObject({ ok: true })
    now = NOW + 5 * 60 * 1000
    expect(await verifySignedRequest(request, options)).toMatchObject({
      code: "signature.replayed",
    })
    now = NOW + 5 * 60 * 1000 + 1000
    expect(await verifySignedRequest(request, options)).toMatchObject({ code: "signature.stale" })
  })

  it.each([
    ["too old", NOW - 5 * 60 * 1000 - 1000],
    ["from the future", NOW + 5 * 60 * 1000 + 1000],
  ])("refuses a timestamp %s", async (_case, signedAt) => {
    expect(await verifySignedRequest(signed({ now: signedAt }), setup())).toEqual({
      ok: false,
      code: "signature.stale",
    })
  })

  it("accepts a timestamp at the edge of the window", async () => {
    const result = await verifySignedRequest(signed({ now: NOW - 5 * 60 * 1000 }), setup())

    expect(result).toMatchObject({ ok: true })
  })

  it.each([
    ["a tampered body", { body: '{"products":1200,"orders_this_month":3}' }],
    ["another path", { path: "/tenant-api/v1/plan" }],
    ["another method", { method: "PUT" }],
  ])("refuses %s", async (_case, change) => {
    expect(await verifySignedRequest({ ...signed(), ...change }, setup())).toEqual({
      ok: false,
      code: "signature.invalid",
    })
  })

  it("refuses a request signed with another key under the tenant's kid", async () => {
    const forged = signRequest({
      method: "POST",
      path: PATH,
      tenantId: TENANT,
      body: BODY,
      signer: { kid: signer.kid, privateKey: stranger.privateKey },
      now: NOW,
    })

    expect(
      await verifySignedRequest(
        { method: "POST", path: PATH, headers: forged, body: BODY },
        setup()
      )
    ).toEqual({ ok: false, code: "signature.invalid" })
  })

  it("refuses an unknown kid and another tenant's id", async () => {
    expect(await verifySignedRequest(signed({ signer: stranger }), setup())).toEqual({
      ok: false,
      code: "signature.unknown_key",
    })
    expect(await verifySignedRequest(signed({ tenantId: "ten_other" }), setup())).toEqual({
      ok: false,
      code: "signature.unknown_key",
    })
  })

  it("refuses a changed tenant or kid header", async () => {
    const request = signed()
    const headers = { ...request.headers, [SIGNED_REQUEST_HEADERS.tenant]: "ten_other" }
    const options = { ...setup(), publicKey: () => signer.privateKey }

    expect(await verifySignedRequest({ ...request, headers }, options)).toEqual({
      ok: false,
      code: "signature.invalid",
    })
  })

  it("does not use up a nonce for a request that fails the signature", async () => {
    const options = setup()
    const request = signed()

    await verifySignedRequest({ ...request, body: "forged" }, options)
    expect(await verifySignedRequest(request, options)).toMatchObject({ ok: true })
  })

  it.each(Object.values(SIGNED_REQUEST_HEADERS))("refuses a request without %s", async (name) => {
    const request = signed()
    const headers = { ...request.headers, [name]: undefined }

    expect(await verifySignedRequest({ ...request, headers }, setup())).toEqual({
      ok: false,
      code: "signature.missing_header",
    })
  })

  it.each([
    ["a repeated header", SIGNED_REQUEST_HEADERS.nonce, ["a".repeat(22), "b".repeat(22)]],
    ["a short nonce", SIGNED_REQUEST_HEADERS.nonce, "abc"],
    ["a non-numeric timestamp", SIGNED_REQUEST_HEADERS.timestamp, "12e3"],
    ["a short signature", SIGNED_REQUEST_HEADERS.signature, "AAAA"],
    ["a tenant id with a newline", SIGNED_REQUEST_HEADERS.tenant, "ten_a\nPOST"],
  ])("refuses %s as malformed", async (_case, name, value) => {
    const request = signed()
    const headers = { ...request.headers, [name]: value }

    expect(await verifySignedRequest({ ...request, headers }, setup())).toEqual({
      ok: false,
      code: "signature.malformed",
    })
  })

  it("refuses a nonce window not strictly longer than the clock window (C9 review L2)", async () => {
    await expect(
      verifySignedRequest(signed(), { ...setup(), maxSkewSeconds: 300, nonceTtlSeconds: 300 })
    ).rejects.toThrow(RangeError)
    await expect(
      verifySignedRequest(signed(), { ...setup(), maxSkewSeconds: 300, nonceTtlSeconds: 600 })
    ).rejects.toThrow(RangeError)
    await expect(
      verifySignedRequest(signed(), { ...setup(), maxSkewSeconds: 300, nonceTtlSeconds: 602 })
    ).resolves.toMatchObject({ ok: true })
  })

  it("refuses to sign a malformed path or tenant id", () => {
    expect(() => signed({ path: "/a b" })).toThrow(TypeError)
    expect(() => signed({ tenantId: "ten a" })).toThrow(TypeError)
  })
})
