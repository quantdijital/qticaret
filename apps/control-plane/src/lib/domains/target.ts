import { parseEnv } from "../env"
import { parseRoutingTarget } from "./verification"
import type { RoutingTarget } from "./verification"

/** Where custom domains are to point, from the environment (validated at startup). */
export function routingTarget(
  source: Record<string, string | undefined> = process.env
): RoutingTarget {
  const env = parseEnv(source)
  return parseRoutingTarget(env.CP_DOMAIN_CNAME_TARGET, env.CP_DOMAIN_A_TARGETS)
}
