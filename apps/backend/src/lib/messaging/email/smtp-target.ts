import { isIP } from "node:net"
import { isLocalEnv, parseEnv } from "../../env"
import { ProviderError } from "../../errors"
import { isBlockedAddress } from "../../security/safe-fetch"
import { systemResolver } from "../../security/safe-fetch/resolver"
import type { Resolver } from "../../security/safe-fetch/resolver"
import { SMTP_PORTS, isLoopbackHost } from "./smtp-account"
import type { SmtpAccount } from "./smtp-account"

/**
 * Where a send or a check connects (adr/0036 Ek 2026-11-10, security
 * review M1): the server calls a host the shop typed, with the shop's
 * password, so it is held to the platform's SSRF policy (docs/04,
 * `isBlockedAddress`) like every server-side request.
 *
 * - The name is resolved here, at every send and check, through the same
 *   c-ares resolver as `safeFetch` (cancellable; it reads public DNS, not
 *   /etc/hosts). Every address it gives must be public; one private,
 *   loopback or metadata address refuses the whole name.
 * - nodemailer is then given that address and a socket already connected
 *   to it, so a second answer from DNS (rebinding) never decides where the
 *   connection goes; the typed name stays the TLS server name, so the
 *   certificate is still checked against it.
 * - The one exception is this machine, typed as such: `localhost`,
 *   127.0.0.0/8 or ::1, never resolved (`localhost` is 127.0.0.1). A local
 *   Postfix, or a backend on the host's network (`network_mode: host`).
 * - Ports: the mail ports only (25, 465, 587, 2525); any port on this
 *   machine in development and tests (Mailpit on 51025).
 */

export interface SmtpTarget {
  /** The address the socket connects to. */
  address: string
  /** The name the certificate must carry; null when the shop typed an address. */
  servername: string | null
  loopback: boolean
}

export interface TargetOptions {
  resolver?: Resolver
  /** Development or tests: any port on this machine. */
  local?: boolean
  timeoutMs?: number
}

const refused = (code: "target_refused" | "port_refused" | "tls_failed") =>
  new ProviderError({ provider: "smtp", providerCode: code, retryable: false })

// What DNS itself answered: no such name is the shop's typo, anything else may pass
const dnsFailure = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code
  return new ProviderError({
    provider: "smtp",
    providerCode: "dns_failed",
    retryable: !(typeof code === "string" && ["ENOTFOUND", "ENODATA"].includes(code)),
  })
}

const localEnv = (): boolean => {
  try {
    return isLocalEnv(parseEnv())
  } catch {
    return false
  }
}

/** Whether the port is one a mail server listens on, or any on this machine locally. */
export const portAllowed = (port: number, loopback: boolean, local: boolean): boolean =>
  SMTP_PORTS.includes(port) || (loopback && local)

export async function resolveSmtpTarget(
  account: Pick<SmtpAccount, "host" | "port" | "security">,
  { resolver = systemResolver, local = localEnv(), timeoutMs = 5_000 }: TargetOptions = {}
): Promise<SmtpTarget> {
  const host = account.host.toLowerCase()
  const loopback = isLoopbackHost(host)
  if (!portAllowed(account.port, loopback, local)) {
    throw refused("port_refused")
  }
  if (account.security === "none" && !loopback) {
    throw refused("tls_failed")
  }
  if (loopback) {
    // Never asked of DNS: a resolver's answer for `localhost` is not this machine's
    return { address: host === "localhost" ? "127.0.0.1" : host, servername: null, loopback }
  }
  if (isIP(host) !== 0) {
    if (isBlockedAddress(host)) {
      throw refused("target_refused")
    }
    return { address: host, servername: null, loopback: false }
  }
  let addresses: readonly { address: string }[]
  try {
    addresses = await resolveWithin(resolver, host, timeoutMs)
  } catch (error) {
    throw dnsFailure(error)
  }
  if (addresses.length === 0) {
    throw dnsFailure({ code: "ENODATA" })
  }
  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw refused("target_refused")
  }
  const [first] = addresses
  return { address: first?.address ?? "", servername: host, loopback: false }
}

async function resolveWithin(resolver: Resolver, host: string, timeoutMs: number) {
  const signal = AbortSignal.timeout(timeoutMs)
  return Promise.race([
    resolver(host, signal),
    new Promise<never>((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          reject(Object.assign(new Error("dns timeout"), { code: "ETIMEOUT" }))
        },
        { once: true }
      )
    }),
  ])
}
