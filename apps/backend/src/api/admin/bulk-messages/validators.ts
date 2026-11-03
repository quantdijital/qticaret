import { z } from "@medusajs/framework/zod"
import { campaignAudience } from "../../../lib/campaigns/types"
import { contentDoc } from "../../../lib/content"
import { CAMPAIGN_STATUSES } from "../../../modules/campaigns/models/campaign"

const name = z.string().trim().min(1).max(100)
const line = (max: number) => z.string().trim().max(max).nullable()

/**
 * A bulk message (adr/0050 §4): its audience as one or more sources, an
 * e-mail's subject (120 at most), preview line and body (a content
 * document), or a text. The server checks tokens, cards and length again.
 */
const fields = {
  name,
  channel: z.enum(["email", "sms"]),
  audience: campaignAudience,
  subject: line(120),
  preheader: line(150),
  body: contentDoc.nullable(),
  sms_text: z.string().trim().max(800).nullable(),
}

export const AdminPostCampaign = z
  .object({
    name: fields.name,
    channel: fields.channel,
    audience: fields.audience,
    subject: fields.subject.optional(),
    preheader: fields.preheader.optional(),
    body: fields.body.optional(),
    sms_text: fields.sms_text.optional(),
  })
  .strict()
export type AdminPostCampaignType = z.infer<typeof AdminPostCampaign>

export const AdminUpdateCampaign = z
  .object({
    name: fields.name.optional(),
    channel: fields.channel.optional(),
    audience: fields.audience.optional(),
    subject: fields.subject.optional(),
    preheader: fields.preheader.optional(),
    body: fields.body.optional(),
    sms_text: fields.sms_text.optional(),
  })
  .strict()
export type AdminUpdateCampaignType = z.infer<typeof AdminUpdateCampaign>

/** "Zamanla": when, with its offset. */
export const AdminScheduleCampaign = z
  .object({ scheduled_at: z.iso.datetime({ offset: true }) })
  .strict()
export type AdminScheduleCampaignType = z.infer<typeof AdminScheduleCampaign>

/** "Kopyala": the new draft's name; the source's by default. */
export const AdminCopyCampaign = z.object({ name: name.optional() }).strict()
export type AdminCopyCampaignType = z.infer<typeof AdminCopyCampaign>

/** The actions that take nothing but the campaign's id. */
export const AdminCampaignAction = z.object({}).strict()

export const AdminGetCampaigns = z
  .object({
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    channel: fields.channel.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetCampaignsType = z.infer<typeof AdminGetCampaigns>

/** The rendered preview (adr/0050 §10): the campaign's own channel unless another is asked. */
export const AdminGetCampaignPreview = z.object({ channel: fields.channel.optional() }).strict()
export type AdminGetCampaignPreviewType = z.infer<typeof AdminGetCampaignPreview>

/** The live count (adr/0050 §3): the campaign's own audience, or the one being edited. */
export const AdminPreviewCampaignAudience = z
  .object({ channel: fields.channel.optional(), audience: fields.audience.optional() })
  .strict()
export type AdminPreviewCampaignAudienceType = z.infer<typeof AdminPreviewCampaignAudience>
