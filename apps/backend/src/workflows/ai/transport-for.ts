import type { MedusaContainer } from "@medusajs/framework/types"
import { isAiCreditTask } from "@qticaret/types/control-plane"
import { aiProviderError } from "../../lib/ai/errors"
import { PLATFORM_SERVICE_ID, platformBackingOf } from "../../lib/ai/registry/platform-service"
import { findAiService } from "../../lib/ai/registry/services"
import type { AiService } from "../../lib/ai/registry/services"
import { ownKeyTransport } from "../../lib/ai/transport/own-key"
import { platformTransport } from "../../lib/ai/transport/platform"
import type { AiCharge, AiTransport } from "../../lib/ai/transport/types"
import { aiCreditsStatus, noteAiCharge } from "../../lib/control-plane/ai-credits"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import { isCredentialProvider } from "../../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { aiFlagsOf } from "./connections"

type Resolver = Pick<MedusaContainer, "resolve">

/**
 * The one way a call site gets its transport (adr/0085 §3): the text
 * call, the picture edit and the assistant's turn ask here with the
 * service chosen for the run. The shop's own service: its key, read here,
 * on the registry's address, as before. `platform`: no key is read; the
 * service the control plane's status names for the capability builds the
 * body, sent signed to the gateway under the run's operation. The
 * storefront's search never asks here (K10).
 */

/**
 * The shop's key for the service, read here and nowhere else: it is no
 * part of a step's input or output (`workflow_execution` keeps those), of
 * a log or of an error. A service without a readable key cannot be called.
 */
export async function apiKeyOf(
  container: Resolver,
  credentialProvider: string
): Promise<string | null> {
  if (!isCredentialProvider(credentialProvider)) {
    return null
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read(credentialProvider)
  const key = account?.secrets["api_key"]
  return typeof key === "string" && key !== "" ? key : null
}

export interface TransportRequest {
  /** The service chosen for the run: one of the registry's, or `platform`. */
  service: string
  capability: "text" | "vision" | "image_edit"
  /** The task's id; on credits the gateway's table names the same (`credit-table.unit.spec.ts`). */
  task: string
  /**
   * The staff member's operation (one `randomUUID()` per action, made
   * where the run's service is chosen): every call of the run, a
   * correction or an assistant's next model call too, carries it. Needed
   * on credits only.
   */
  operation?: string | null | undefined
  /** On credits: told each answer's charge too (the run's usage rows, `charge-tally.ts`). */
  onCharge?: ((charge: AiCharge) => void) | undefined
}

export interface AiRoute {
  /** The registered service whose connector builds the body and reads the answer. */
  service: AiService
  transport: AiTransport
}

const platformRefusal = (code: string) =>
  aiProviderError({ service: PLATFORM_SERVICE_ID, key: "ai.platform_unavailable", code })

async function platformRoute(request: TransportRequest, container: Resolver): Promise<AiRoute> {
  // Not sold on credits (the storefront's search, the key test): never sent to the gateway
  if (!isAiCreditTask(request.task)) {
    throw platformRefusal("not_offered")
  }
  if ((await aiFlagsOf(container)).platformCredits !== true) {
    throw platformRefusal("flag_off")
  }
  const status = await aiCreditsStatus()
  if (!status.available) {
    throw platformRefusal("status_unavailable")
  }
  const service = platformBackingOf(status.services, request.capability)
  if (service === null) {
    throw platformRefusal("no_route")
  }
  if (typeof request.operation !== "string") {
    throw platformRefusal("no_operation")
  }
  return {
    service,
    transport: platformTransport({
      task: request.task,
      capability: request.capability,
      service: service.id,
      operation: request.operation,
      // Each answer's wallet left updates the kept status; nothing is kept on the transport
      onCharge: (charge) => {
        noteAiCharge(charge)
        request.onCharge?.(charge)
      },
    }),
  }
}

export async function transportFor(
  container: Resolver,
  request: TransportRequest
): Promise<AiRoute> {
  if (request.service === PLATFORM_SERVICE_ID) {
    return platformRoute(request, container)
  }
  const service = findAiService(request.service)
  if (service === null) {
    throw aiProviderError({
      service: request.service,
      key: "ai.service_unavailable",
      code: "not_registered",
    })
  }
  const apiKey = await apiKeyOf(container, service.credentialProvider)
  if (apiKey === null) {
    throw aiProviderError({
      service: request.service,
      key: "ai.service_unavailable",
      code: "no_credentials",
    })
  }
  return { service, transport: ownKeyTransport(apiKey) }
}
