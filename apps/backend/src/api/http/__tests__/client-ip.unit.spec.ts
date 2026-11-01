import type { MedusaRequest } from "@medusajs/framework/http"
import { CLIENT_IP_HEADERS, signClientIp } from "../../../lib/security/client-ip"
import { resetClientIpSecret, storeProfileOf } from "../client-ip"

const SECRET = "s".repeat(40)

const request = (headers: Record<string, string>) =>
  ({ headers, ip: "198.51.100.1", socket: {} }) as unknown as MedusaRequest

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
})
