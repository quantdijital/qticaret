import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type { PRIVACY_REQUEST_CHANNELS, PRIVACY_REQUEST_KINDS } from "../../modules/legal/service"
import { enqueueAsyncJobWorkflow } from "../async-job/enqueue-async-job"

export interface RecordPrivacyRequestInput {
  customer_id: string
  kind: (typeof PRIVACY_REQUEST_KINDS)[number]
  channel: (typeof PRIVACY_REQUEST_CHANNELS)[number]
  received_at: string
  recorded_by: string
}

/** A customer's request as it came (adr/0041 §6); undone, the record goes. */
const recordPrivacyRequestStep = createStep(
  "legal-record-privacy-request",
  async (input: RecordPrivacyRequestInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "customer",
      fields: ["id"],
      filters: { id: input.customer_id },
    })
    if (data.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
    }
    const request = await container
      .resolve<LegalModuleService>(LEGAL_MODULE)
      .createPrivacyRequests({ ...input, received_at: new Date(input.received_at) })
    return new StepResponse(request, request.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<LegalModuleService>(LEGAL_MODULE).deletePrivacyRequests([id])
    }
  }
)

/** F13.5: a customer's KVKK request, recorded by staff. */
export const recordPrivacyRequestWorkflow = createWorkflow(
  "legal-record-privacy-request",
  (input: RecordPrivacyRequestInput) => new WorkflowResponse(recordPrivacyRequestStep(input))
)

/** The open request of a kind, or a refusal: answered ones take nothing more. */
export async function openRequest(
  container: Pick<MedusaContainer, "resolve">,
  id: string,
  kind: (typeof PRIVACY_REQUEST_KINDS)[number]
) {
  const [request] = await container
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listPrivacyRequests({ id }, { take: 1 })
  if (!request) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "privacy_requests.unknown")
  }
  if (request.kind !== kind || request.status !== "open") {
    throw new ConflictError("privacy_requests.not_open")
  }
  return request
}

const readExportRequestStep = createStep(
  "legal-read-export-request",
  async (input: { request_id: string }, { container }) => {
    const request = await openRequest(container, input.request_id, "export")
    return new StepResponse({ customer_id: request.customer_id })
  }
)

const linkExportJobStep = createStep(
  "legal-link-export-job",
  async (input: { request_id: string; job_id: string }, { container }) => {
    await container
      .resolve<LegalModuleService>(LEGAL_MODULE)
      .updatePrivacyRequests({ id: input.request_id, job_id: input.job_id })
    return new StepResponse(input.job_id, input.request_id)
  },
  async (requestId, { container }) => {
    if (requestId) {
      await container
        .resolve<LegalModuleService>(LEGAL_MODULE)
        .updatePrivacyRequests({ id: requestId, job_id: null })
    }
  }
)

/**
 * Prepares the copy an export request asks for: a private job whose file
 * staff send the customer. Asked again (a file expired), a new job.
 */
export const startDataExportWorkflow = createWorkflow(
  "legal-start-data-export",
  (input: { request_id: string; requested_by: string }) => {
    const request = readExportRequestStep({ request_id: input.request_id })
    const job = enqueueAsyncJobWorkflow.runAsStep({
      input: transform({ input, request }, ({ input, request }) => ({
        type: "customer.data_export",
        input: { customer_id: request.customer_id },
        requested_by: input.requested_by,
      })),
    })
    linkExportJobStep(
      transform({ input, job }, ({ input, job }) => ({
        request_id: input.request_id,
        job_id: job.id,
      }))
    )
    return new WorkflowResponse(job)
  }
)

/**
 * Answers a request: done (the copy sent, the data erased) or refused (the
 * asker not who they claimed). Undone, it is open again.
 */
export const closePrivacyRequestStep = createStep(
  "legal-close-privacy-request",
  async (
    input: { request_id: string; status: "completed" | "rejected"; by: string },
    { container }
  ) => {
    const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
    const [request] = await service.listPrivacyRequests({ id: input.request_id }, { take: 1 })
    if (!request) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "privacy_requests.unknown")
    }
    if (request.status !== "open") {
      throw new ConflictError("privacy_requests.not_open")
    }
    const closed = await service.updatePrivacyRequests({
      id: input.request_id,
      status: input.status,
      completed_at: new Date(),
      completed_by: input.by,
    })
    return new StepResponse(closed, input.request_id)
  },
  async (requestId, { container }) => {
    if (requestId) {
      await container.resolve<LegalModuleService>(LEGAL_MODULE).updatePrivacyRequests({
        id: requestId,
        status: "open",
        completed_at: null,
        completed_by: null,
      })
    }
  }
)

export const closePrivacyRequestWorkflow = createWorkflow(
  "legal-close-privacy-request",
  (input: { request_id: string; status: "completed" | "rejected"; by: string }) =>
    new WorkflowResponse(closePrivacyRequestStep(input))
)
