import type { MedusaRequest } from "@medusajs/framework/http"
import { CLIENT_IP_HEADERS, CLIENT_IP_UNKNOWN, signClientIp } from "../../../lib/security/client-ip"
import {
  clientIp,
  isShopperAddressUnknown,
  isStorefrontSigned,
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

describe("the storefront's signed calls (adr/0046 §5)", () => {
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
    // "Address unknown" is the storefront's too
    expect(storeProfileOf(request(signed(CLIENT_IP_UNKNOWN))).name).toBe("storefront_default")
  })

  it("keeps a direct client, or a forged signature, in the default bucket", () => {
    expect(storeProfileOf(request({})).name).toBe("store_default")
    expect(storeProfileOf(request(signed("203.0.113.9", "x".repeat(40)))).name).toBe(
      "store_default"
    )
  })

  it("knows a shopper's address as unknown only when the storefront signed it so (adr/0076 Ek D5)", () => {
    const server = "10.0.0.5"
    expect(isShopperAddressUnknown(request(signed(CLIENT_IP_UNKNOWN), server))).toBe(true)
    // The address itself is never the word: the connection's, as an unsigned call's
    expect(clientIp(request(signed(CLIENT_IP_UNKNOWN), server))).toBe(server)
    expect(isStorefrontSigned(request(signed(CLIENT_IP_UNKNOWN), server))).toBe(true)
    // A signed address, a plain unsigned call or a forged "unknown" is not
    expect(isShopperAddressUnknown(request(signed("203.0.113.9"), server))).toBe(false)
    expect(clientIp(request(signed("203.0.113.9"), server))).toBe("203.0.113.9")
    expect(isShopperAddressUnknown(request({}, server))).toBe(false)
    expect(
      isShopperAddressUnknown(request(signed(CLIENT_IP_UNKNOWN, "x".repeat(40)), server))
    ).toBe(false)
    expect(isShopperAddressUnknown(request({ [CLIENT_IP_HEADERS.ip]: CLIENT_IP_UNKNOWN }))).toBe(
      false
    )
  })

  it("believes nothing without the secret", () => {
    delete process.env["STOREFRONT_IP_SECRET"]
    resetClientIpSecret()
    expect(isShopperAddressUnknown(request(signed(CLIENT_IP_UNKNOWN)))).toBe(false)
    expect(isStorefrontSigned(request(signed("203.0.113.9")))).toBe(false)
  })
})

describe("Cloudflare's CF-Connecting-IP (adr/0044 Ek 2026-11-24)", () => {
  const before = process.env["TRUST_CF_CONNECTING_IP"]
  const beforeSecret = process.env["STOREFRONT_IP_SECRET"]
  afterEach(() => {
    process.env["TRUST_CF_CONNECTING_IP"] = before
    process.env["STOREFRONT_IP_SECRET"] = beforeSecret
    if (before === undefined) {
      delete process.env["TRUST_CF_CONNECTING_IP"]
    }
    if (beforeSecret === undefined) {
      delete process.env["STOREFRONT_IP_SECRET"]
    }
    resetClientIpSecret()
  })

  beforeEach(() => {
    // The suite above leaves the word "undefined" behind when it had no secret
    delete process.env["STOREFRONT_IP_SECRET"]
  })

  const edge = "172.68.1.1"
  const viaCloudflare = (value: string) => request({ "cf-connecting-ip": value }, edge)

  it("ignores the header unless told to trust it", () => {
    delete process.env["TRUST_CF_CONNECTING_IP"]
    resetClientIpSecret()
    expect(clientIp(viaCloudflare("203.0.113.9"))).toBe(edge)
  })

  it("takes one valid address when trusted, after the storefront's signed one", () => {
    process.env["TRUST_CF_CONNECTING_IP"] = "on"
    process.env["STOREFRONT_IP_SECRET"] = SECRET
    resetClientIpSecret()
    expect(clientIp(viaCloudflare("203.0.113.9"))).toBe("203.0.113.9")
    expect(clientIp(viaCloudflare("2001:db8::1"))).toBe("2001:db8::1")
    expect(clientIp(viaCloudflare("203.0.113.9, 198.51.100.7"))).toBe(edge)
    expect(clientIp(viaCloudflare("bir-adres"))).toBe(edge)
    expect(
      clientIp(request({ ...signed("198.51.100.20"), "cf-connecting-ip": "203.0.113.9" }, edge))
    ).toBe("198.51.100.20")
  })
})
