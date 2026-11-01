import { CLIENT_IP_HEADERS, signClientIp, verifiedClientIp } from "../client-ip"

const SECRET = "storefront-ip-secret-for-unit-tests-0123456789"
const NOW = 1_793_000_000

const signed = (ip: string, time = NOW, secret = SECRET): Record<string, string> => ({
  [CLIENT_IP_HEADERS.ip]: ip,
  [CLIENT_IP_HEADERS.time]: String(time),
  [CLIENT_IP_HEADERS.signature]: signClientIp(secret, ip, time),
})

describe("verifiedClientIp", () => {
  it("believes a fresh, correctly signed IPv4 or IPv6 address", () => {
    expect(verifiedClientIp(signed("203.0.113.7"), SECRET, NOW)).toBe("203.0.113.7")
    expect(verifiedClientIp(signed("2001:db8::1"), SECRET, NOW + 59)).toBe("2001:db8::1")
  })

  it("matches the storefront's signature (a fixed vector both sides test)", () => {
    expect(signClientIp("k".repeat(32), "198.51.100.4", 1_700_000_000)).toBe(
      "3df4a55af2bdea5b476cafcfe1972d40a7c98648dd41d903c5f0563f5a19a828"
    )
  })

  it("ignores the headers when no secret is configured", () => {
    expect(verifiedClientIp(signed("203.0.113.7"), undefined, NOW)).toBeNull()
    expect(verifiedClientIp(signed("203.0.113.7"), "", NOW)).toBeNull()
  })

  it("refuses another secret's signature and a signature for another address", () => {
    expect(verifiedClientIp(signed("203.0.113.7", NOW, `${SECRET}x`), SECRET, NOW)).toBeNull()
    const headers = { ...signed("203.0.113.7"), [CLIENT_IP_HEADERS.ip]: "203.0.113.8" }
    expect(verifiedClientIp(headers, SECRET, NOW)).toBeNull()
  })

  it("refuses a signature older or newer than a minute", () => {
    expect(verifiedClientIp(signed("203.0.113.7", NOW - 61), SECRET, NOW)).toBeNull()
    expect(verifiedClientIp(signed("203.0.113.7", NOW + 61), SECRET, NOW)).toBeNull()
  })

  it("refuses malformed, missing or repeated headers", () => {
    expect(verifiedClientIp({}, SECRET, NOW)).toBeNull()
    expect(verifiedClientIp(signed("not-an-ip"), SECRET, NOW)).toBeNull()
    const repeated: Record<string, string | string[]> = {
      ...signed("203.0.113.7"),
      [CLIENT_IP_HEADERS.ip]: ["203.0.113.7", "203.0.113.7"],
    }
    expect(verifiedClientIp(repeated, SECRET, NOW)).toBeNull()
    const badTime = { ...signed("203.0.113.7"), [CLIENT_IP_HEADERS.time]: "12e3" }
    expect(verifiedClientIp(badTime, SECRET, NOW)).toBeNull()
  })
})
