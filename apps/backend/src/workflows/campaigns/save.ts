import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { emptyCounts } from "../../lib/campaigns/types"
import type { CampaignSource } from "../../lib/campaigns/types"
import type { ContentDoc } from "../../lib/content"
import { ConflictError } from "../../lib/errors"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { checkContent, utmCodeOf } from "./content"
import type { CampaignDraft } from "./content"

const EDITABLE = [
  "name",
  "channel",
  "audience",
  "subject",
  "preheader",
  "body",
  "sms_text",
] as const

export type CampaignChanges = Partial<CampaignDraft>

type Service = CampaignsModuleService

const serviceOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<Service>(CAMPAIGNS_MODULE)

/** A campaign found, or 404. */
export async function campaignOf(service: Service, id: string) {
  const [campaign] = await service.listBulkMessages({ id }, { take: 1 })
  if (!campaign) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "campaigns.unknown")
  }
  return campaign
}

/** A new draft, its content checked; undone by removing it. */
const createCampaignStep = createStep(
  "campaigns-create",
  async (input: CampaignDraft & { created_by: string | null }, { container }) => {
    await checkContent(container, input)
    const created = await serviceOf(container).createBulkMessages({
      name: input.name,
      channel: input.channel,
      audience: input.audience as unknown as Record<string, unknown>,
      subject: input.subject,
      preheader: input.preheader,
      body: input.body as unknown as Record<string, unknown> | null,
      sms_text: input.sms_text,
      utm_campaign: utmCodeOf(input.name),
      status: "draft",
      counts: emptyCounts() as unknown as Record<string, unknown>,
      created_by: input.created_by,
    })
    return new StepResponse({ id: created.id }, created.id)
  },
  async (id, { container }) => {
    if (id) {
      await serviceOf(container).deleteBulkMessages(id)
    }
  }
)

/** A draft written (adr/0050 §2): the bulk messages' list and editor. */
export const createCampaignWorkflow = createWorkflow(
  "campaigns-create",
  (input: CampaignDraft & { created_by: string | null }) =>
    new WorkflowResponse(createCampaignStep(input))
)

/**
 * A draft changed. Only a draft: once it is scheduled or sending its
 * content is what the re-authenticated person approved (adr/0050 §2); a
 * change after that is a copy. Undone by putting the old fields back.
 */
const updateCampaignStep = createStep(
  "campaigns-update",
  async (input: { id: string; changes: CampaignChanges }, { container }) => {
    const service = serviceOf(container)
    const current = await campaignOf(service, input.id)
    if (current.status !== "draft") {
      throw new ConflictError("campaigns.locked")
    }
    const merged: CampaignDraft = {
      name: input.changes.name ?? current.name,
      channel: input.changes.channel ?? current.channel,
      audience: input.changes.audience ?? (current.audience as unknown as CampaignSource[]),
      subject: input.changes.subject !== undefined ? input.changes.subject : current.subject,
      preheader:
        input.changes.preheader !== undefined ? input.changes.preheader : current.preheader,
      body:
        input.changes.body !== undefined
          ? input.changes.body
          : (current.body as unknown as ContentDoc | null),
      sms_text: input.changes.sms_text !== undefined ? input.changes.sms_text : current.sms_text,
    }
    await checkContent(container, merged)
    const previous = Object.fromEntries(EDITABLE.map((field) => [field, current[field]]))
    await service.updateBulkMessages({
      id: input.id,
      ...(merged as unknown as Record<string, unknown>),
    })
    return new StepResponse({ id: input.id }, { id: input.id, previous })
  },
  async (undo, { container }) => {
    if (undo) {
      await serviceOf(container).updateBulkMessages({ id: undo.id, ...undo.previous })
    }
  }
)

export const updateCampaignWorkflow = createWorkflow(
  "campaigns-update",
  (input: { id: string; changes: CampaignChanges }) =>
    new WorkflowResponse(updateCampaignStep(input))
)

/** A draft removed; one that went to anyone stays for its report. Undone by restoring it. */
const deleteCampaignStep = createStep(
  "campaigns-delete",
  async (input: { id: string }, { container }) => {
    const service = serviceOf(container)
    const current = await campaignOf(service, input.id)
    if (current.status !== "draft") {
      throw new ConflictError("campaigns.locked")
    }
    await service.softDeleteBulkMessages(input.id)
    return new StepResponse({ id: input.id }, input.id)
  },
  async (id, { container }) => {
    if (id) {
      await serviceOf(container).restoreBulkMessages(id)
    }
  }
)

export const deleteCampaignWorkflow = createWorkflow(
  "campaigns-delete",
  (input: { id: string }) => new WorkflowResponse(deleteCampaignStep(input))
)

/** "Kopyala" (adr/0050 §2): a new draft with the campaign's audience and content. */
const copyCampaignStep = createStep(
  "campaigns-copy",
  async (input: { id: string; name: string; created_by: string | null }, { container }) => {
    const service = serviceOf(container)
    const source = await campaignOf(service, input.id)
    const created = await service.createBulkMessages({
      name: input.name,
      channel: source.channel,
      audience: source.audience,
      subject: source.subject,
      preheader: source.preheader,
      body: source.body,
      sms_text: source.sms_text,
      utm_campaign: utmCodeOf(input.name),
      status: "draft",
      counts: emptyCounts() as unknown as Record<string, unknown>,
      created_by: input.created_by,
    })
    return new StepResponse({ id: created.id }, created.id)
  },
  async (id, { container }) => {
    if (id) {
      await serviceOf(container).deleteBulkMessages(id)
    }
  }
)

export const copyCampaignWorkflow = createWorkflow(
  "campaigns-copy",
  (input: { id: string; name: string; created_by: string | null }) =>
    new WorkflowResponse(copyCampaignStep(input))
)
