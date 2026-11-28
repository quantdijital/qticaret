import type { DomainRecord } from "../../modules/tenants/types"
import { routingTarget } from "./target"
import { dnsInstructions } from "./verification"
import type { DnsInstructions } from "./verification"

/**
 * A domain as staff see it (F16.7): its state and, for a custom one, the
 * records its owner publishes (the proof's TXT, where to point). The
 * token travels only inside those records.
 */
export function domainView<T extends Omit<DomainRecord, "tenant_id">>(
  domain: T,
  target = routingTarget()
): Omit<T, "verification_token"> & { dns: DnsInstructions | null } {
  const { verification_token: token, ...rest } = domain
  return {
    ...rest,
    dns: domain.kind === "custom" && token ? dnsInstructions(domain.hostname, token, target) : null,
  }
}
