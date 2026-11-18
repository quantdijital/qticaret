import type { AiErrorKey } from "./errors"
import { aiServices, sceneTargetOf } from "./registry/services"
import type { AiService } from "./registry/services"
import type { AiTask } from "./registry/tasks"

/**
 * Which service runs a task (adr/0071 §4). One pure decision on the
 * server: the shop fills no "task → service" table, and nothing falls
 * back to another service by itself; a failure carries the others so the
 * panel can offer "try with another service".
 */

/** A credential row reduced to its state (`GET /admin/ai/services`). */
export type AiConnectionStatus = "connected" | "unverified" | "rejected" | "unreadable"

export interface AiConnection {
  /** The service's `credentialProvider`. */
  provider: string
  status: AiConnectionStatus
}

/** Which ways of paying are open for the shop (adr/0071 §6). */
export interface AiFlags {
  ownKeys: boolean
  platformCredits?: boolean
}

const fundingOpen = (service: AiService, flags: AiFlags): boolean =>
  service.funding === "own_key" ? flags.ownKeys : flags.platformCredits === true

/** The service has the task's capability, and a scene endpoint where the task sets a scene. */
export function canRunTask(service: AiService, task: AiTask): boolean {
  const target = service.capabilities[task.capability]
  if (target === undefined) {
    return false
  }
  return task.optionSource !== "scenes" || sceneTargetOf(target) !== null
}

/** Connected and verified ∩ able to do the task ∩ paid in a way that is open; registry order. */
export function usableServices(
  task: AiTask,
  connections: readonly AiConnection[],
  flags: AiFlags,
  services: readonly AiService[] = aiServices()
): AiService[] {
  const connected = new Set(
    connections.filter((each) => each.status === "connected").map((each) => each.provider)
  )
  return services.filter(
    (service) =>
      connected.has(service.credentialProvider) &&
      canRunTask(service, task) &&
      fundingOpen(service, flags)
  )
}

export type AiChoice =
  | { ok: true; service: AiService; alternatives: string[] }
  | {
      ok: false
      error: Extract<AiErrorKey, "ai.no_service" | "ai.service_unavailable">
      alternatives: string[]
    }

/** The usable services but one: what "try with another service" offers after a failure. */
export const alternativesTo = (usable: readonly AiService[], id: string | null): string[] =>
  usable.filter((service) => service.id !== id).map((service) => service.id)

/**
 * The service for this run. None usable: `ai.no_service`. One: that one,
 * whatever was asked. Several: the requested one (`ai.service_unavailable`
 * when it is not among them), else the remembered preference, else the
 * first in registry order.
 */
export function chooseService(input: {
  task: AiTask
  usable: readonly AiService[]
  requested?: string | null | undefined
  preference?: string | null | undefined
}): AiChoice {
  const { usable, requested, preference } = input
  const [first, second] = usable
  if (first === undefined) {
    return { ok: false, error: "ai.no_service", alternatives: [] }
  }
  const pick = (service: AiService): AiChoice => ({
    ok: true,
    service,
    alternatives: alternativesTo(usable, service.id),
  })
  if (second === undefined) {
    return pick(first)
  }
  if (requested !== undefined && requested !== null) {
    const asked = usable.find((service) => service.id === requested)
    return asked
      ? pick(asked)
      : { ok: false, error: "ai.service_unavailable", alternatives: alternativesTo(usable, null) }
  }
  return pick(usable.find((service) => service.id === preference) ?? first)
}
