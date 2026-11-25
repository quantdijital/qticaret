import { MedusaError } from "@medusajs/framework/utils"
import {
  AI_TARGET_CAPABILITIES,
  aiTargetModels,
  aiTargetServiceIds,
  aiTargetUncapped,
  aiTargetUnverified,
} from "@qticaret/types/control-plane"
import type { AiTargetCapability } from "@qticaret/types/control-plane"

/**
 * The routing (adr/0085 §2): which service and model run a capability on
 * the platform's credits. Only a service in the shared target table, only
 * a capability that service has, only a model the table allows for it;
 * the gateway never takes an address or a model from a shop's request.
 */

export interface AiRoute {
  service: string
  model: string
}

export type AiRouting = Partial<Record<AiTargetCapability, AiRoute>>

const nodeEnv = () => process.env["NODE_ENV"]

const refuse = (key: string) => new MedusaError(MedusaError.Types.INVALID_DATA, key)

export const isTargetCapability = (value: string): value is AiTargetCapability =>
  (AI_TARGET_CAPABILITIES as readonly string[]).includes(value)

/** A service the platform can hold a key for (the fake one in test and development only). */
export const isKnownService = (service: string): boolean =>
  aiTargetServiceIds(nodeEnv()).includes(service)

/** `route` checked for `capability`; refused with the reason's key. */
export function checkedRoute(capability: string, route: AiRoute): AiRoute {
  if (!isTargetCapability(capability)) {
    throw refuse("cp.ai_route_capability_unknown")
  }
  if (!isKnownService(route.service)) {
    throw refuse("cp.ai_route_service_unknown")
  }
  const models = aiTargetModels(route.service, capability, nodeEnv())
  if (models === null) {
    throw refuse("cp.ai_route_capability_unsupported")
  }
  // An output no documented field caps is not sold on credits (ai-targets.ts `GEMINI_CHAT`)
  if (aiTargetUncapped(route.service, capability)) {
    throw refuse("cp.ai_route_uncapped")
  }
  // Not yet proven by a real call (ai-targets.ts `unverified`: Bria's result host)
  if (aiTargetUnverified(route.service, capability)) {
    throw refuse("cp.ai_route_unverified")
  }
  if (!models.includes(route.model)) {
    throw refuse("cp.ai_route_model_not_allowed")
  }
  return { service: route.service, model: route.model }
}

/** A routing as given (null: not routed), every entry checked. */
export function checkedRouting(given: Readonly<Record<string, AiRoute | null>>): AiRouting {
  const routing: AiRouting = {}
  for (const [capability, route] of Object.entries(given)) {
    if (route !== null) {
      routing[capability as AiTargetCapability] = checkedRoute(capability, route)
    }
  }
  return routing
}

/**
 * A stored routing read back: an entry no longer valid (a service or
 * model since taken out of the table) is left out, so it never routes.
 */
export function storedRouting(value: unknown): AiRouting {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  const routing: AiRouting = {}
  for (const [capability, route] of Object.entries(value as Record<string, unknown>)) {
    const candidate = route as Partial<AiRoute> | null
    if (typeof candidate?.service !== "string" || typeof candidate.model !== "string") {
      continue
    }
    try {
      routing[capability as AiTargetCapability] = checkedRoute(capability, {
        service: candidate.service,
        model: candidate.model,
      })
    } catch {
      // Not routable any more: left out
    }
  }
  return routing
}

/** The capabilities routed to `service`. */
export const capabilitiesRoutedTo = (routing: AiRouting, service: string): AiTargetCapability[] =>
  (Object.entries(routing) as [AiTargetCapability, AiRoute][])
    .filter(([, route]) => route.service === service)
    .map(([capability]) => capability)
