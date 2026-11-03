import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { smsLength } from "../../lib/campaigns/sms"
import type { CampaignChannel } from "../../lib/campaigns/types"
import { emailLinkUrl } from "../../lib/messaging/links"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import { brandOf } from "../messaging/brand"
import { personalise, prepareCampaign, renderCampaign } from "./prepare"
import { campaignOf } from "./save"

/**
 * The token a preview's way out carries: the link where it would be, in
 * its look, but no token of ours (`recipientOfToken` wants a keyed hash
 * and its signature), so the unsubscribe page refuses it and a click on
 * it withdraws no one's consent.
 */
export const PREVIEW_UNSUBSCRIBE_TOKEN = "preview"

export type CampaignPreview =
  { subject: string; preheader: string; html: string } | { text: string; parts: number }

export interface PreviewInput {
  id: string
  /** The staff member asking: their own first name stands in for `{ad}`. */
  user_id: string
  /** The campaign's own channel unless another is asked. */
  channel?: CampaignChannel | undefined
}

/**
 * GET /admin/bulk-messages/:id/preview (adr/0050 §10): the campaign as it
 * would go now, for one sample recipient, the staff member asking. Made
 * as every send is (prepareCampaign → personalise → renderCampaign): the
 * shop's details, prices and paths read now, the footer and the opt-out
 * line in place. No customer is read, nothing is sent or counted.
 */
export async function campaignPreview(
  container: MedusaContainer,
  input: PreviewInput
): Promise<CampaignPreview> {
  const campaign = await campaignOf(container.resolve(CAMPAIGNS_MODULE), input.id)
  const channel = input.channel ?? campaign.channel
  const [[user], brand, prepared] = await Promise.all([
    container
      .resolve(Modules.USER)
      .listUsers({ id: input.user_id }, { select: ["first_name"], take: 1 }),
    brandOf(container),
    prepareCampaign(container, { ...campaign, channel }),
  ])
  const vars = personalise(prepared, user?.first_name ?? null)
  const leave = emailLinkUrl("unsubscribe", PREVIEW_UNSUBSCRIBE_TOKEN, brand.storefrontUrl)
  const rendered = renderCampaign(channel, vars, brand, leave)
  if (rendered.channel === "sms") {
    // The parts as the backend counts them, for the text as it would go
    return { text: rendered.text, parts: smsLength(rendered.text).parts }
  }
  return { subject: rendered.email.subject, preheader: vars.preheader, html: rendered.email.html }
}
