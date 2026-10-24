import { isIP } from "node:net"
import { SafeFetchError } from "./errors"

export const DEFAULT_ALLOWED_PORTS: readonly number[] = [80, 443]

const DEFAULT_PORTS: Readonly<Record<string, number>> = { "http:": 80, "https:": 443 }

export interface CheckedUrl {
  url: URL
  port: number
  /** Hostname without IPv6 brackets. */
  host: string
  /** Set when the host is an IP literal; DNS is skipped for it. */
  literalAddress: string | null
}

/**
 * Parses and checks a URL before any connection. WHATWG URL parsing already
 * turns numeric host forms (`0x7f.1`, `2130706433`) into dotted IPv4, so the
 * address policy sees the real address.
 */
export function checkUrl(input: string | URL, allowedPorts: readonly number[]): CheckedUrl {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    // No cause: Node's ERR_INVALID_URL keeps the whole input, tokens included
    throw new SafeFetchError("invalid_url")
  }
  const defaultPort = DEFAULT_PORTS[url.protocol]
  if (defaultPort === undefined) {
    throw new SafeFetchError("protocol_not_allowed")
  }
  if (url.username !== "" || url.password !== "") {
    throw new SafeFetchError("credentials_in_url")
  }
  const port = url.port === "" ? defaultPort : Number(url.port)
  if (!allowedPorts.includes(port)) {
    throw new SafeFetchError("port_not_allowed")
  }
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1")
  if (host === "") {
    throw new SafeFetchError("invalid_url")
  }
  return { url, port, host, literalAddress: isIP(host) === 0 ? null : host }
}
