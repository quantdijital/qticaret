import { aiTargetUncapped } from "@qticaret/types/control-plane"
import type { AiCapability } from "./capabilities"
import { FAKE_SERVICE, findAiService } from "./services"
import type { AiService, AiTarget } from "./services"

/**
 * The platform's credits as a service (adr/0085 §3): `platform`, paid
 * from the platform's wallet. It has no address and no key of its own:
 * each capability is run by the service the control plane's status names
 * for it, whose registered target builds the body (the connector, the
 * protocol) and reads the answer, sent through the platform's transport.
 * Which service that is never reaches the shop's panel: the status's
 * `services` are read here only. A capability the status names no usable
 * service for is one the platform does not have.
 */

export const PLATFORM_SERVICE_ID = "platform"

/** What a call on credits can run as (the gateway's capabilities); generation and video are not sold. */
const PLATFORM_CAPABILITIES = [
  "text",
  "vision",
  "image_edit",
] as const satisfies readonly AiCapability[]

/**
 * The registered service behind a capability on credits, or null: the
 * status names none, a service this instance does not list or one without
 * that capability, the fake one (a call on credits must reach the
 * gateway, which the fake connector never does) or a chat target with no
 * output cap (never routed on credits, adr/0085 Ek (P3b) f).
 */
export function platformBackingOf(
  services: Readonly<Record<string, string>>,
  capability: AiCapability,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): AiService | null {
  const id = Object.hasOwn(services, capability) ? services[capability] : undefined
  if (id === undefined || id === FAKE_SERVICE.id || aiTargetUncapped(id, capability)) {
    return null
  }
  const service = findAiService(id, nodeEnv)
  return service?.capabilities[capability] ? service : null
}

/** The `platform` service for the status's routing; null when it routes no capability this shop can use. */
export function platformServiceOf(
  services: Readonly<Record<string, string>>,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): AiService | null {
  const capabilities: Partial<Record<AiCapability, AiTarget>> = {}
  for (const capability of PLATFORM_CAPABILITIES) {
    const target = platformBackingOf(services, capability, nodeEnv)?.capabilities[capability]
    if (target) {
      capabilities[capability] = target
    }
  }
  if (Object.keys(capabilities).length === 0) {
    return null
  }
  return {
    id: PLATFORM_SERVICE_ID,
    // No credential row: "connected" is the flag and the status (connections.ts)
    credentialProvider: PLATFORM_SERVICE_ID,
    funding: "platform_credit",
    // Never called directly: the gateway's address is the control plane's
    hosts: [],
    downloadHosts: [],
    capabilities,
    // Credits, not a provider's price: what a task costs is the gateway's table (K4)
    unitPrices: {},
    dataNoteKey: "ai.data_note.platform",
  }
}

export const isPlatformService = (service: Pick<AiService, "funding">): boolean =>
  service.funding === "platform_credit"
