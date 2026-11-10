import { ipBucket } from "../ip"

describe("ipBucket", () => {
  it.each([
    ["an IPv4 address", "203.0.113.7", "203.0.113.7"],
    ["an IPv4-mapped IPv6 address", "::ffff:203.0.113.7", "203.0.113.7"],
    ["a full IPv6 address", "2001:0db8:0001:0002:0003:0004:0005:0006", "2001:db8:1:2::/64"],
    ["a compressed IPv6 address", "2001:db8:1:2::9", "2001:db8:1:2::/64"],
    ["compression inside the prefix", "2001:db8::1", "2001:db8:0:0::/64"],
    ["loopback", "::1", "0:0:0:0::/64"],
    ["an embedded IPv4 tail", "64:ff9b::192.0.2.1", "64:ff9b:0:0::/64"],
  ])("buckets %s", (_label, address, bucket) => {
    expect(ipBucket(address)).toBe(bucket)
  })

  it.each([
    ["a forged X-Forwarded-For value", "x".repeat(200)],
    ["a list", "203.0.113.7, 198.51.100.1"],
    ["nothing", undefined],
  ])("refuses %s", (_label, address) => {
    expect(ipBucket(address)).toBeNull()
  })
})
