import { isBlockedAddress } from "../address-policy"

describe("isBlockedAddress", () => {
  it.each([
    ["this network", "0.0.0.0"],
    ["private 10/8", "10.1.2.3"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["loopback", "127.0.0.1"],
    ["loopback, high end", "127.255.255.254"],
    ["cloud metadata", "169.254.169.254"],
    ["private 172.16/12", "172.31.255.255"],
    ["IETF assignments", "192.0.0.8"],
    ["TEST-NET-1", "192.0.2.1"],
    ["6to4 relay", "192.88.99.1"],
    ["private 192.168/16", "192.168.1.1"],
    ["benchmarking", "198.19.0.1"],
    ["TEST-NET-2", "198.51.100.7"],
    ["TEST-NET-3", "203.0.113.9"],
    ["multicast", "224.0.0.1"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["IPv6 unspecified", "::"],
    ["IPv6 loopback", "::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped public", "::ffff:8.8.8.8"],
    ["IPv4-mapped, hex form", "::ffff:7f00:1"],
    ["NAT64", "64:ff9b::a00:1"],
    ["local NAT64", "64:ff9b:1::1"],
    ["discard-only", "100::1"],
    ["Teredo", "2001:0:4136:e378:8000:63bf:3fff:fdd2"],
    ["documentation", "2001:db8::1"],
    ["6to4", "2002:c000:0204::1"],
    ["unique local fc", "fc00::1"],
    ["unique local fd", "fd12:3456::1"],
    ["link-local", "fe80::1"],
    ["site-local", "fec0::1"],
    ["multicast", "ff02::1"],
    ["IPv4-compatible", "::7f00:1"],
    ["IPv4-translated", "::ffff:0:a00:1"],
    ["documentation 3fff::/20", "3fff::1"],
    ["SRv6 SIDs", "5f00::1"],
    ["dummy prefix", "100:0:0:1::1"],
    ["ECS metadata", "169.254.170.2"],
    ["EC2 IPv6 metadata", "fd00:ec2::254"],
    ["not an address", "example.com"],
    ["empty", ""],
  ])("blocks %s (%s)", (_label, address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each([
    ["public IPv4", "8.8.8.8"],
    ["public IPv4 next to a private range", "172.32.0.1"],
    ["public IPv4 next to CGNAT", "100.128.0.1"],
    ["public IPv6", "2606:4700:4700::1111"],
    ["public IPv6 next to Teredo", "2001:200::1"],
    ["the address before 172.16/12", "172.15.255.255"],
    ["the address before CGNAT", "100.63.255.255"],
    ["the address before benchmarking", "198.17.255.255"],
    ["the address after benchmarking", "198.20.0.0"],
    ["the address before link-local", "169.253.255.255"],
    ["the last address before multicast", "223.255.255.255"],
    ["another public IPv6", "2600::1"],
  ])("allows %s (%s)", (_label, address) => {
    expect(isBlockedAddress(address)).toBe(false)
  })
})
