import { BlockList, isIP } from "node:net"

/**
 * Addresses a server-side request must never reach (docs/04 SSRF): private,
 * loopback, link-local and cloud metadata, carrier-grade NAT, multicast,
 * documentation and reserved ranges, and IPv6 forms that embed an IPv4
 * address (mapped, compatible, NAT64, 6to4, Teredo), which could point back
 * inside. A NAT64 deployment with its own prefix would need that prefix
 * added here (F16).
 */

const IPV4_BLOCKED: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
]

// IPv6 must be global unicast (2000::/3); everything outside it (loopback,
// unspecified, IPv4-compatible and -translated, NAT64, discard, ULA,
// link-local, site-local, multicast, future special ranges) is refused
// without listing it. These are the special ranges inside 2000::/3.
const IPV6_BLOCKED_GLOBAL: readonly (readonly [string, number])[] = [
  ["2001::", 23], // IETF protocol assignments, Teredo included
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["3fff::", 20], // documentation (RFC 9637)
]

const ipv6GlobalUnicast = new BlockList()
ipv6GlobalUnicast.addSubnet("2000::", 3, "ipv6")

// Kept apart: BlockList compares IPv4 addresses in their IPv4-mapped IPv6
// form, so this range in the main list would match every IPv4 address
const ipv4Mapped = new BlockList()
ipv4Mapped.addSubnet("::ffff:0:0", 96, "ipv6")

const blocked = new BlockList()
for (const [network, prefix] of IPV4_BLOCKED) {
  blocked.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of IPV6_BLOCKED_GLOBAL) {
  blocked.addSubnet(network, prefix, "ipv6")
}

/** True for an address that is not a public unicast address; anything that is not an IP counts as blocked. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) {
    return true
  }
  if (family === 4) {
    return blocked.check(address, "ipv4")
  }
  return (
    ipv4Mapped.check(address, "ipv6") ||
    !ipv6GlobalUnicast.check(address, "ipv6") ||
    blocked.check(address, "ipv6")
  )
}
