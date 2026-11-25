import { randomUUID } from "node:crypto"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { productPhotoOf } from "../../../lib/ai/facts/product-attributes"
import type { AiImageRef } from "../../../lib/ai/facts/media"
import type { AiFunding, AiService } from "../../../lib/ai/registry/services"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import type { AiTask } from "../../../lib/ai/registry/tasks"
import { canRunTask, chooseService, usableServices } from "../../../lib/ai/select"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { aiConnectionsOf, aiFlagsOf, aiServicesFor } from "../connections"

export interface SelectServiceInput {
  task: string
  user_id: string
  /** The service the staff member picked; only when several are usable. */
  service?: string | null | undefined
  /**
   * A queued job's way of paying, set when it was queued (a bulk job's
   * item): only services paid that way are usable, so an item never moves
   * to the platform's credits or back by itself.
   */
  funding?: AiFunding | undefined
  /** The record asked for: a `photo` task looks for its picture (adr/0074 §5 madde 3). */
  entity_type?: string | undefined
  entity_id?: string | undefined
}

/**
 * The product's picture a `photo` task reads (adr/0074 §5 madde 3), or
 * null: the task reads none, the record is no product, the chosen service
 * has no `vision`, or the product has no stored, readable picture. The
 * service is chosen first, as for any text task, so the picker and a
 * remembered choice mean the same; the picture only adds to what it reads.
 */
async function photoOf(
  container: Parameters<typeof productPhotoOf>[0],
  task: AiTask,
  service: AiService,
  input: SelectServiceInput
): Promise<AiImageRef | null> {
  if (
    task.photo !== true ||
    input.entity_type !== "product" ||
    typeof input.entity_id !== "string" ||
    !canRunTask(service, { ...task, capability: "vision" })
  ) {
    return null
  }
  return productPhotoOf(container, input.entity_id)
}

/**
 * The service a task runs on for this staff member now (adr/0071 §4): the
 * usable ones are only what `usableServices` makes of the shop's accounts
 * and the package's flags, and `chooseService` picks among them. Throws
 * the choice's error. Also what a bulk job reads when it is queued, to
 * keep the way of paying it was queued with (`aiAltText.prepare`).
 */
export async function pickServiceFor(
  container: Parameters<typeof aiConnectionsOf>[0],
  input: Pick<SelectServiceInput, "task" | "user_id" | "service" | "funding">
): Promise<{ task: AiTask; service: AiService; alternatives: string[]; several: boolean }> {
  const task = findAiTask(input.task)
  if (!task) {
    throw aiValidationError("ai.unknown_task")
  }
  const [connections, flags, preference] = await Promise.all([
    aiConnectionsOf(container),
    aiFlagsOf(container),
    container.resolve<AiModuleService>(AI_MODULE).preferenceOf(input.user_id, task.id),
  ])
  // The platform's credits come after the shop's own: picked, remembered or alone (adr/0085 K8)
  const open = usableServices(task, connections, flags, await aiServicesFor(flags))
  const usable =
    input.funding === undefined ? open : open.filter((each) => each.funding === input.funding)
  if (usable.length === 0 && open.length > 0) {
    // Usable only paid another way than the job was queued with: it stops, never spends otherwise
    throw aiValidationError("ai.service_unavailable")
  }
  const choice = chooseService({ task, usable, requested: input.service, preference })
  if (!choice.ok) {
    throw aiValidationError(choice.error)
  }
  return {
    task,
    service: choice.service,
    alternatives: choice.alternatives,
    several: usable.length > 1,
  }
}

/**
 * Which service runs the task (`pickServiceFor`). Only the service's id
 * leaves this step; its key is read where it is used (`call-service`).
 * Nothing to undo.
 */
export const selectServiceStep = createStep(
  "ai-select-service",
  async (input: SelectServiceInput, { container }) => {
    const { task, ...choice } = await pickServiceFor(container, input)
    const photo = await photoOf(container, task, choice.service, input)
    return new StepResponse({
      service: choice.service.id,
      // A `photo` task runs as `vision` when the chosen service sees and the product has a picture
      capability: photo === null ? task.capability : ("vision" as const),
      image_file_id: photo?.file_id ?? null,
      funding: choice.service.funding,
      // This run's operation (adr/0085 K3): its every call (a correction too) is one charge on credits
      operation: randomUUID(),
      alternatives: choice.alternatives,
      // Several to choose from and one asked for: the picker was used, so it is remembered
      remember: choice.several && typeof input.service === "string",
    })
  }
)

/**
 * A queued job's picture asks for the service it was queued with, paid
 * the same way: when the shop's accounts or the package's flags changed
 * meanwhile (`ai.own_keys` closed, the key removed) the choice made now
 * differs, and the job stops rather than spend on another service or
 * another way of paying than the one the staff member agreed to.
 * Nothing to undo.
 */
export const keepQueuedServiceStep = createStep(
  "ai-keep-queued-service",
  (input: {
    queued: { service: string; funding: string }
    chosen: { service: string; funding: string }
  }) => {
    if (
      input.chosen.service !== input.queued.service ||
      input.chosen.funding !== input.queued.funding
    ) {
      throw aiValidationError("ai.service_unavailable")
    }
    return new StepResponse(true)
  }
)
