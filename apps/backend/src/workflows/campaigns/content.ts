import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MAX_PRODUCT_CARDS } from "../../lib/campaigns/email-doc"
import { unknownCampaignDocTokens, unknownCampaignTokens } from "../../lib/campaigns/tokens"
import type { CampaignSource } from "../../lib/campaigns/types"
import { docStats } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { ValidationError } from "../../lib/errors"
import { toSlug } from "../../lib/seo/slug"
import { assertCards, mediaOf } from "../content/rules"
import { assertSmsFits } from "./sms-length"

/** A campaign as staff write it (adr/0050 §4). */
export interface CampaignDraft {
  name: string
  channel: "email" | "sms"
  audience: CampaignSource[]
  subject: string | null
  preheader: string | null
  body: ContentDoc | null
  sms_text: string | null
}

const refuseTokens = (text: string | null, field: string) => {
  if (text && unknownCampaignTokens(text).length > 0) {
    throw new ValidationError("campaigns.token_unknown", { field })
  }
}

/**
 * What a campaign may hold (adr/0050 §4): only known `{belirteç}`s; in an
 * e-mail, images from the shop's media library, cards for products and
 * categories that exist, four product cards at most; a text of three
 * parts at most as it would go at its longest (smsPartsOf): its links with
 * the campaign's utm, the longest name, its shop name and opt-out line.
 */
export async function checkContent(
  container: MedusaContainer,
  draft: CampaignDraft,
  utmCampaign: string
) {
  refuseTokens(draft.subject, "subject")
  refuseTokens(draft.preheader, "preheader")
  refuseTokens(draft.sms_text, "sms_text")
  if (draft.body) {
    if (unknownCampaignDocTokens(draft.body).length > 0) {
      throw new ValidationError("campaigns.token_unknown", { field: "body" })
    }
    const stats = docStats(draft.body)
    if (new Set(stats.cards.product).size > MAX_PRODUCT_CARDS) {
      throw new ValidationError("campaigns.too_many_products", { field: "body" })
    }
    await mediaOf(
      container,
      stats.images.map((image) => image.src),
      "body"
    )
    await assertCards(container, draft.body)
  }
  await assertSmsFits(container, { sms_text: draft.sms_text, utm_campaign: utmCampaign })
}

/** Whether the campaign has what its channel needs to go: a subject and a body, or a text. */
export function assertComplete(campaign: {
  channel: string
  subject: string | null
  body: unknown
  sms_text: string | null
}): void {
  if (campaign.channel === "sms") {
    if (!campaign.sms_text?.trim()) {
      throw new ValidationError("campaigns.content_missing", { field: "sms_text" })
    }
    return
  }
  const body = campaign.body as ContentDoc | null
  if (!campaign.subject?.trim()) {
    throw new ValidationError("campaigns.content_missing", { field: "subject" })
  }
  if (!body || body.content.length === 0) {
    throw new ValidationError("campaigns.content_missing", { field: "body" })
  }
}

/** A campaign's `utm_campaign`: its name as a slug, made unique. */
export const utmCodeOf = (name: string): string =>
  `${toSlug(name, 40) || "kampanya"}-${randomBytes(3).toString("hex")}`
