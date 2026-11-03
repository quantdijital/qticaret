import type { MedusaContainer } from "@medusajs/framework/types"
import { LONGEST_NAME, SMS_MAX_PARTS, smsLength } from "../../lib/campaigns/sms"
import type { SmsLength } from "../../lib/campaigns/sms"
import { ValidationError } from "../../lib/errors"
import type { Brand } from "../../lib/messaging/templates"
import { brandOf } from "../messaging/brand"
import { personalise, prepareCampaign, renderCampaign } from "./prepare"
import type { PreparedCampaign } from "./prepare"

/** What a text's length is read from: the campaign's text and its utm code. */
export interface SmsSource {
  sms_text: string | null
  utm_campaign: string
}

/**
 * A text's length as it would go now to the recipient whose name makes it
 * longest (adr/0050 §4), made as every send is (prepareCampaign →
 * personalise → renderCampaign): the shop's links with their utm, its name
 * and opt-out line, the longest name for `{ad}`. The save check,
 * `audience-preview` and the preview all count with it, so none can differ
 * from another; a recipient with a shorter name may get a shorter text.
 */
export function longestSms(prepared: PreparedCampaign, brand: Brand): SmsLength {
  const rendered = renderCampaign("sms", personalise(prepared, LONGEST_NAME), brand, null)
  return smsLength(rendered.channel === "sms" ? rendered.text : "")
}

/** The parts of a campaign's text at its longest, the shop read now. */
export async function smsPartsOf(container: MedusaContainer, source: SmsSource): Promise<number> {
  const [brand, prepared] = await Promise.all([
    brandOf(container),
    prepareCampaign(container, {
      channel: "sms",
      subject: null,
      preheader: null,
      body: null,
      sms_text: source.sms_text,
      utm_campaign: source.utm_campaign,
    }),
  ])
  return longestSms(prepared, brand).parts
}

/** Refuses a text longer than three parts at its longest (adr/0050 §4). */
export async function assertSmsFits(container: MedusaContainer, source: SmsSource): Promise<void> {
  if (source.sms_text && (await smsPartsOf(container, source)) > SMS_MAX_PARTS) {
    throw new ValidationError("campaigns.sms_too_long", { field: "sms_text" })
  }
}
