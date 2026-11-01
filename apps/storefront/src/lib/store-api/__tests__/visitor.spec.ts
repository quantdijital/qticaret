import { describe, expect, it } from "vitest"
import { CLIENT_IP_HEADERS, signClientIp, signedVisitorHeaders, visitorIp } from "../visitor"

describe("signClientIp", () => {
  it("matches the backend's signature (the same fixed vector as client-ip.unit.spec.ts)", () => {
    expect(signClientIp("k".repeat(32), "198.51.100.4", 1_700_000_000)).toBe(
      "3df4a55af2bdea5b476cafcfe1972d40a7c98648dd41d903c5f0563f5a19a828"
    )
  })
})

describe("visitorIp", () => {
  const headers = (values: Record<string, string>) => new Headers(values)

  it("takes the right-most forwarded address, past the trusted proxies", () => {
    const forwarded = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" })
    expect(visitorIp(forwarded)).toBe("10.0.0.2")
    expect(visitorIp(forwarded, 1)).toBe("203.0.113.9")
  })

  it("reads an IPv4-mapped address as IPv4 and refuses what is not an address", () => {
    expect(visitorIp(headers({ "x-forwarded-for": "::ffff:203.0.113.9" }))).toBe("203.0.113.9")
    expect(visitorIp(headers({ "x-forwarded-for": "unknown" }))).toBeNull()
    expect(visitorIp(headers({}))).toBeNull()
    // A header the client writes itself is never the address
    expect(visitorIp(headers({ "x-real-ip": "2001:db8::7" }))).toBeNull()
    // A chain shorter than the proxies stated: no address rather than the client's word
    expect(visitorIp(headers({ "x-forwarded-for": "6.6.6.6" }), 1)).toBeNull()
  })
})

describe("signedVisitorHeaders", () => {
  it("signs the address with the time, or sends nothing without both", () => {
    const signed = signedVisitorHeaders("s".repeat(32), "203.0.113.9", 1_700_000_000)
    expect(signed[CLIENT_IP_HEADERS.ip]).toBe("203.0.113.9")
    expect(signed[CLIENT_IP_HEADERS.time]).toBe("1700000000")
    expect(signed[CLIENT_IP_HEADERS.signature]).toMatch(/^[0-9a-f]{64}$/)
    expect(signedVisitorHeaders(undefined, "203.0.113.9")).toEqual({})
    expect(signedVisitorHeaders("s".repeat(32), null)).toEqual({})
  })
})
