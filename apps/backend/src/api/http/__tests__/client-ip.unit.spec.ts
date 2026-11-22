import type { MedusaRequest } from "@medusajs/framework/http"
import { CLIENT_IP_HEADERS, signClientIp } from "../../../lib/security/client-ip"
import {
  STOREFRONT_SEEN_MS,
  isStorefrontUnsigned,
  resetClientIpSecret,
  storeProfileOf,
} from "../client-ip"

const SECRET = "s".repeat(40)

const request = (headers: Record<string, string>, ip = "198.51.100.1") =>
  ({ headers, ip, socket: {} }) as unknown as MedusaRequest

const signed = (ip: string, secret = SECRET) => {
  const time = Math.floor(Date.now() / 1000)
  return {
    [CLIENT_IP_HEADERS.ip]: ip,
    [CLIENT_IP_HEADERS.time]: String(time),
    [CLIENT_IP_HEADERS.signature]: signClientIp(secret, ip, time),
  }
}

describe("storeProfileOf (adr/0046 §5)", () => {
  const before = process.env["STOREFRONT_IP_SECRET"]
  beforeEach(() => {
    process.env["STOREFRONT_IP_SECRET"] = SECRET
    resetClientIpSecret()
  })
  afterAll(() => {
    process.env["STOREFRONT_IP_SECRET"] = before
    resetClientIpSecret()
  })

  it("counts the storefront's signed calls in their own, wider bucket", () => {
    const profile = storeProfileOf(request(signed("203.0.113.9")))
    expect(profile.name).toBe("storefront_default")
    expect(profile.perIp?.max).toBeGreaterThan(600)
  })

  it("keeps a direct client, or a forged signature, in the default bucket", () => {
    expect(storeProfileOf(request({})).name).toBe("store_default")
    expect(storeProfileOf(request(signed("203.0.113.9", "x".repeat(40)))).name).toBe(
      "store_default"
    )
  })

  it("knows an unsigned call from the storefront's server by an address it signed from lately", () => {
    const server = "10.0.0.5"
    const now = Date.now()

    // Not seen signing yet: not known as the storefront
    expect(isStorefrontUnsigned(request({}, server), now)).toBe(false)
    // A signed call is never "unsigned"; it teaches the server's address
    expect(isStorefrontUnsigned(request(signed("203.0.113.9"), server), now)).toBe(false)
    expect(isStorefrontUnsigned(request({}, server), now + 1000)).toBe(true)
    // Another client, or a forged signature from it, is not the storefront
    expect(isStorefrontUnsigned(request({}, "198.51.100.1"), now)).toBe(false)
    expect(
      isStorefrontUnsigned(request(signed("203.0.113.9", "x".repeat(40)), "198.51.100.2"), now)
    ).toBe(false)
    expect(isStorefrontUnsigned(request({}, "198.51.100.2"), now)).toBe(false)
    // Forgotten when it has not signed for a while
    expect(isStorefrontUnsigned(request({}, server), now + STOREFRONT_SEEN_MS + 1)).toBe(false)
  })

  it("learns nothing without the secret", () => {
    delete process.env["STOREFRONT_IP_SECRET"]
    resetClientIpSecret()
    const now = Date.now()
    isStorefrontUnsigned(request(signed("203.0.113.9"), "10.0.0.6"), now)
    expect(isStorefrontUnsigned(request({}, "10.0.0.6"), now)).toBe(false)
  })
})
