import { fakeTextConnector } from "./connectors/fake"
import { fakeToolConnector } from "./connectors/fake-tools"
import { openAiCompatibleText } from "./connectors/openai-compatible"
import { openAiCompatibleTools } from "./connectors/openai-tools"
import type { TextConnector, ToolConnector } from "./connectors/types"
import { aiProviderError } from "./errors"
import type { AiCapability } from "./registry/capabilities"
import { findAiService, verifiedToolCalls } from "./registry/services"
import type { AiService, AiTarget } from "./registry/services"

/**
 * The one way to a connector (adr/0071 §2, §9): by a service's id,
 * through the registry of this instance. Nothing else builds one, so the
 * fake service runs only where the registry lists it (tests and
 * development; never staging or production) and no address but the
 * registry's is called. The key is handed to the connector here and kept
 * in its closure only.
 */

export interface ResolvedTarget {
  service: AiService
  target: AiTarget
}

/** The service and its target for a text capability; null when this instance has neither. */
export function textTargetOf(
  serviceId: string,
  capability: Extract<AiCapability, "text" | "vision">,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): ResolvedTarget | null {
  const service = findAiService(serviceId, nodeEnv)
  const target = service?.capabilities[capability]
  return service && target ? { service, target } : null
}

/** The text connector of a registered service, with the shop's key. */
export function textConnectorFor(
  serviceId: string,
  capability: Extract<AiCapability, "text" | "vision">,
  apiKey: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): TextConnector {
  const resolved = textTargetOf(serviceId, capability, nodeEnv)
  if (resolved === null) {
    throw aiProviderError({
      service: serviceId,
      key: "ai.service_unavailable",
      code: "not_registered",
    })
  }
  const { service, target } = resolved
  if (target.connector === "fake") {
    return fakeTextConnector
  }
  if (target.connector !== "openai-compatible") {
    throw aiProviderError({ service: serviceId, key: "ai.service_unavailable", code: "not_text" })
  }
  return openAiCompatibleText({ service, target, apiKey })
}

/**
 * The tool calling connector of a registered service (adr/0079 §2), only
 * where its tool support is verified in the registry; any other service
 * is refused here, whatever asked for it.
 */
export function toolConnectorFor(
  serviceId: string,
  apiKey: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): ToolConnector {
  const resolved = textTargetOf(serviceId, "text", nodeEnv)
  const refuse = (code: string) =>
    aiProviderError({ service: serviceId, key: "ai.service_unavailable", code })
  if (resolved === null) {
    throw refuse("not_registered")
  }
  const { service, target } = resolved
  if (verifiedToolCalls(service) === null) {
    throw refuse("tools_unverified")
  }
  if (target.connector === "fake") {
    return fakeToolConnector
  }
  if (target.connector !== "openai-compatible") {
    throw refuse("not_text")
  }
  return openAiCompatibleTools({ service, target, apiKey })
}
