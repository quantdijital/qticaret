import { isIP } from "node:net"

/**
 * The address a client is counted under (docs/04). IPv6 counts by its /64:
 * every connection gets at least a /64, so counting single addresses would
 * let one client rotate past every limit. IPv4-mapped IPv6 counts as the
 * IPv4 address. Anything that is not an IP address (a forged
 * X-Forwarded-For value) gives null.
 */
export function ipBucket(address: string | undefined): string | null {
  if (address === undefined) {
    return null
  }
  const ip = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1] ?? address
  switch (isIP(ip)) {
    case 4:
      return ip
    case 6:
      return `${ipv6Prefix64(ip)}::/64`
    default:
      return null
  }
}

// The first four groups of an IPv6 address, written without leading zeros
function ipv6Prefix64(ip: string): string {
  const groups = (part: string) =>
    part === ""
      ? []
      : part.split(":").flatMap((group) => (group.includes(".") ? ["0", "0"] : [group]))
  const [head = "", tail] = ip.split("::")
  const front = groups(head)
  const back = tail === undefined ? [] : groups(tail)
  const zeros = new Array<string>(Math.max(0, 8 - front.length - back.length)).fill("0")
  const full = tail === undefined ? front : [...front, ...zeros, ...back]
  return full
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(":")
}
