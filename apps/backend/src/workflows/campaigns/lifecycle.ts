import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { countsOf } from "../../lib/campaigns/types"
import type { CampaignSource } from "../../lib/campaigns/types"
import { ConflictError, ValidationError } from "../../lib/errors"
import { emailTransport } from "../../lib/messaging/email"
import { netgsmAccountOf } from "../../lib/messaging/sms/netgsm"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type { CampaignStatus } from "../../modules/campaigns/models/campaign"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { MarketingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { currentSenderDomain } from "../messaging/sender-domain"
import { resolveAudience } from "./audience"
import { assertComplete } from "./content"
import { campaignOf } from "./save"

type Container = Pick<MedusaContainer, "resolve">

/** How far ahead a campaign may be scheduled. */
const SCHEDULE_MAX_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Why the channel cannot carry a campaign now, or null (adr/0050 §7): an
 * e-mail goes only from the shop's own verified domain, a text only with
 * the shop's SMS account and its opt-out line.
 */
export async function channelBlocker(
  container: Container,
  channel: "email" | "sms"
): Promise<string | null> {
  if (channel === "email") {
    if (emailTransport() === null) {
      return "campaigns.channel_off"
    }
    return (await currentSenderDomain(container))?.status === "verified"
      ? null
      : "campaigns.sender_unverified"
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("netgsm")
  if (netgsmAccountOf(account) === null) {
    return "campaigns.sms_account_missing"
  }
  const marketing = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("marketing")) as unknown as MarketingSettings
  return marketing.sms_opt_out_text ? null : "campaigns.sms_opt_out_missing"
}

const serviceOf = (container: Container) =>
  container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)

/**
 * Ready to go: its content complete, its channel able to carry it, and
 * someone to receive it now, counted exactly as the live count counts
 * (`audience-preview`, resolveAudience). The job fixes the list again on
 * its first turn; a campaign that would reach nobody is refused here.
 */
async function assertReady(container: Container, id: string) {
  const campaign = await campaignOf(serviceOf(container), id)
  assertComplete(campaign)
  const blocker = await channelBlocker(container, campaign.channel)
  if (blocker) {
    throw new ValidationError(blocker)
  }
  const { eligible } = await resolveAudience(container, {
    channel: campaign.channel,
    sources: campaign.audience as unknown as CampaignSource[],
    campaign_id: campaign.id,
  })
  if (eligible.length === 0) {
    throw new ValidationError("campaigns.audience_empty", { field: "audience" })
  }
  return campaign
}

interface Moved {
  id: string
  from: CampaignStatus
  fields: Record<string, unknown>
}

/** Moves the campaign or refuses: someone else moved it first, or it is past this. */
async function move(
  container: Container,
  id: string,
  from: readonly CampaignStatus[],
  to: CampaignStatus,
  fields: Record<string, unknown>
): Promise<void> {
  if (!(await serviceOf(container).transition(id, from, to, fields))) {
    throw new ConflictError("campaigns.status_conflict")
  }
}

/** Puts the campaign back as the step found it (a later step failed). */
const undoMove = async (moved: Moved | undefined, { container }: { container: Container }) => {
  if (moved) {
    await serviceOf(container).updateBulkMessages({
      id: moved.id,
      status: moved.from,
      ...moved.fields,
    })
  }
}

/** "Zamanla" (adr/0050 §6): ready to go, at a time ahead; the job starts it then. */
const scheduleCampaignStep = createStep(
  "campaigns-schedule",
  async (input: { id: string; scheduled_at: Date; user_id: string | null }, { container }) => {
    const campaign = await assertReady(container, input.id)
    const at = new Date(input.scheduled_at)
    const now = Date.now()
    if (!(at.getTime() > now && at.getTime() < now + SCHEDULE_MAX_MS)) {
      throw new ValidationError("campaigns.schedule_invalid", { field: "scheduled_at" })
    }
    await move(container, input.id, ["draft", "scheduled"], "scheduled", {
      scheduled_at: at,
      sent_by: input.user_id,
    })
    return new StepResponse(
      { id: input.id, status: "scheduled" },
      {
        id: input.id,
        from: campaign.status,
        fields: { scheduled_at: campaign.scheduled_at, sent_by: campaign.sent_by },
      }
    )
  },
  undoMove
)

export const scheduleCampaignWorkflow = createWorkflow(
  "campaigns-schedule",
  (input: { id: string; scheduled_at: Date; user_id: string | null }) =>
    new WorkflowResponse(scheduleCampaignStep(input))
)

/** "Gönder": sending now; the job fixes its list and sends in turns. */
const sendCampaignStep = createStep(
  "campaigns-send",
  async (input: { id: string; user_id: string | null }, { container }) => {
    const campaign = await assertReady(container, input.id)
    await move(container, input.id, ["draft", "scheduled"], "sending", {
      started_at: new Date(),
      sent_by: input.user_id,
    })
    return new StepResponse(
      { id: input.id, status: "sending" },
      {
        id: input.id,
        from: campaign.status,
        fields: { started_at: null, sent_by: campaign.sent_by },
      }
    )
  },
  undoMove
)

export const sendCampaignWorkflow = createWorkflow(
  "campaigns-send",
  (input: { id: string; user_id: string | null }) => new WorkflowResponse(sendCampaignStep(input))
)

/** Staff stop a sending campaign; what went stays sent. */
const pauseCampaignStep = createStep(
  "campaigns-pause",
  async (input: { id: string }, { container }) => {
    await move(container, input.id, ["sending"], "paused", {
      paused_reason: "staff",
      paused_day: null,
    })
    return new StepResponse(
      { id: input.id, status: "paused" },
      { id: input.id, from: "sending" as const, fields: { paused_reason: null } }
    )
  },
  undoMove
)

export const pauseCampaignWorkflow = createWorkflow(
  "campaigns-pause",
  (input: { id: string }) => new WorkflowResponse(pauseCampaignStep(input))
)

/**
 * Staff send a paused campaign on, whatever stopped it. After an automatic
 * stop for complaints, the rates count again from here (adr/0050 §6).
 */
const resumeCampaignStep = createStep(
  "campaigns-resume",
  async (input: { id: string }, { container }) => {
    const campaign = await campaignOf(serviceOf(container), input.id)
    const blocker = await channelBlocker(container, campaign.channel)
    if (blocker) {
      throw new ValidationError(blocker)
    }
    const counts = countsOf(campaign.counts)
    const review =
      campaign.paused_reason === "complaints"
        ? { sent: counts.sent, bounces: counts.bounces, complaints: counts.complaints }
        : counts.review
    await move(container, input.id, ["paused"], "sending", {
      paused_reason: null,
      paused_day: null,
      counts: { ...counts, review },
    })
    return new StepResponse(
      { id: input.id, status: "sending" },
      {
        id: input.id,
        from: "paused" as const,
        fields: { paused_reason: campaign.paused_reason, counts: campaign.counts },
      }
    )
  },
  undoMove
)

export const resumeCampaignWorkflow = createWorkflow(
  "campaigns-resume",
  (input: { id: string }) => new WorkflowResponse(resumeCampaignStep(input))
)

/** A campaign stopped for good; its recipients not yet reached get nothing. */
const cancelCampaignStep = createStep(
  "campaigns-cancel",
  async (input: { id: string }, { container }) => {
    const campaign = await campaignOf(serviceOf(container), input.id)
    await move(container, input.id, ["scheduled", "sending", "paused"], "cancelled", {
      finished_at: new Date(),
    })
    return new StepResponse(
      { id: input.id, status: "cancelled" },
      { id: input.id, from: campaign.status, fields: { finished_at: null } }
    )
  },
  undoMove
)

export const cancelCampaignWorkflow = createWorkflow(
  "campaigns-cancel",
  (input: { id: string }) => new WorkflowResponse(cancelCampaignStep(input))
)
