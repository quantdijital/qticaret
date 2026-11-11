/**
 * Host names a shop answers on (adr/0061 §2): its subdomain under the
 * platform's domain (`PLATFORM_DOMAIN`, a setting: not decided yet, local
 * addresses in development) and the shop's own domains.
 */

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

/** The shop's subdomain on the platform: `<slug>.<platform domain>`. */
export const platformHostname = (slug: string, platformDomain: string): string =>
  `${slug}.${platformDomain}`

/** Lower-cased, the trailing dot of a fully qualified name and surrounding space dropped. */
export const normalizeHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

export type HostnameProblem = "cp.domain_invalid" | "cp.domain_platform"

/**
 * Why a custom domain cannot be recorded, or null: a public name of two
 * labels at least, letters, digits and hyphens (an internationalised name
 * in its `xn--` form), not an address, not under the platform's domain
 * (those are the platform's to give).
 */
export function customHostnameProblem(
  hostname: string,
  platformDomain: string
): HostnameProblem | null {
  const labels = hostname.split(".")
  const valid =
    hostname.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label)) &&
    /^[a-z][a-z0-9-]*$/.test(labels[labels.length - 1] ?? "") &&
    !hostname.endsWith(".localhost")
  if (!valid) {
    return "cp.domain_invalid"
  }
  return hostname === platformDomain || hostname.endsWith(`.${platformDomain}`)
    ? "cp.domain_platform"
    : null
}
