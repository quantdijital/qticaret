import { customHostnameProblem, normalizeHostname, platformHostname } from "./hostname"
import type { HostnameProblem } from "./hostname"
import { slugProblem } from "./slug"
import type { SlugProblem } from "./slug"

/**
 * Whether a new shop's address can be had (C11's wizard, before the record
 * is made): the slug by its rules and whether a shop has it, its platform
 * host name, and an own domain by its rules and whether any shop answers on
 * it. The create route checks all of it again; this only saves a person
 * from finding out at the last step.
 */

export interface AvailabilityLookups {
  slugTaken: (slug: string) => Promise<boolean>
  hostTaken: (hostname: string) => Promise<boolean>
}

export interface SlugAvailability {
  value: string
  /** `<slug>.<PLATFORM_DOMAIN>`: the shop's subdomain once made. */
  hostname: string
  problem: SlugProblem | "cp.slug_taken" | "cp.domain_taken" | null
}

export interface HostnameAvailability {
  value: string
  problem: HostnameProblem | "cp.domain_taken" | null
}

export async function slugAvailability(
  slug: string,
  platformDomain: string,
  lookups: AvailabilityLookups
): Promise<SlugAvailability> {
  const value = slug.trim().toLowerCase()
  const hostname = platformHostname(value, platformDomain)
  const rule = slugProblem(value)
  if (rule) {
    return { value, hostname, problem: rule }
  }
  if (await lookups.slugTaken(value)) {
    return { value, hostname, problem: "cp.slug_taken" }
  }
  // The record checks its subdomain apart from its slug: both must be free
  return {
    value,
    hostname,
    problem: (await lookups.hostTaken(hostname)) ? "cp.domain_taken" : null,
  }
}

export async function hostnameAvailability(
  hostname: string,
  platformDomain: string,
  lookups: AvailabilityLookups
): Promise<HostnameAvailability> {
  const value = normalizeHostname(hostname)
  const rule = customHostnameProblem(value, platformDomain)
  if (rule) {
    return { value, problem: rule }
  }
  return { value, problem: (await lookups.hostTaken(value)) ? "cp.domain_taken" : null }
}
