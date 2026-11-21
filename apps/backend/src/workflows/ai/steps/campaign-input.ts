import type { MedusaContainer } from "@medusajs/framework/types"
import { composeSms, smsLength } from "../../../lib/campaigns/sms"
import { figuresOf } from "../../../lib/ai/campaign-text"
import type { CampaignAllowed } from "../../../lib/ai/campaign-text"
import { aiValidationError } from "../../../lib/ai/errors"
import { AI_FACT_MAX_LENGTHS, withShop } from "../../../lib/ai/facts"
import { campaignFacts } from "../../../lib/ai/facts/campaign"
import { buildPrompt } from "../../../lib/ai/prompt"
import { CAMPAIGN_SMS_ROOM_FIELD, factLengthsOf } from "../../../lib/ai/registry/tasks"
import type { AiTask } from "../../../lib/ai/registry/tasks"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { MarketingSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { brandOf } from "../../messaging/brand"

/** One GSM part's septets (lib/campaigns/sms.ts). */
const ONE_PART = 155
const ONE_UCS2_PART = 70
/**
 * The room asked for, of what is left: a Turkish letter (ş, ğ, ı, İ, ç)
 * takes two septets, which a model does not count. The gate counts.
 */
const ASKED_SHARE = 0.8

/** What one SMS leaves for the text once its end (the shop's name, the opt-out line) is counted. */
export function smsRoom(shop: string, optOut: string): number {
  // The end, with the full stop and space a text gets before it ("a. Mağaza. RET…" less the "a")
  const length = smsLength(composeSms("a", shop, optOut))
  // An end outside the GSM table sends every text as UCS-2: one part holds 70
  return Math.max(0, (length.encoding === "gsm" ? ONE_PART : ONE_UCS2_PART) - (length.units - 1))
}

export interface CampaignInput {
  system: string
  data: string
  campaign: CampaignAllowed
}

/**
 * A bulk message's words (adr/0074 §5 madde 6): the campaign's own words
 * (facts/campaign.ts) and the shop's name, nothing about its audience.
 * The task names the channel: an SMS task asked for an e-mail (or the
 * other way) is `ai.unknown_entity`. Held on the server beside the
 * prompt: the figures the data holds (the only ones a text may write)
 * and an SMS's end (the shop's name and opt-out line, as the send adds).
 */
export async function campaignInput(
  container: Pick<MedusaContainer, "resolve">,
  task: AiTask,
  instruction: string,
  campaignId: string
): Promise<CampaignInput> {
  const facts = await campaignFacts(container, campaignId)
  const sms = task.gate === "campaign_sms"
  if (facts.channel !== (sms ? "sms" : "email")) {
    throw aiValidationError("ai.unknown_entity")
  }
  const { shopName } = await brandOf(container)
  const fields = withShop(facts.fields, shopName)
  const numbers = figuresOf(Object.values(fields).filter((v): v is string => typeof v === "string"))
  let end: CampaignAllowed["sms"] = null
  if (sms) {
    const marketing = (await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("marketing")) as unknown as MarketingSettings
    end = { shop: shopName, opt_out: marketing.sms_opt_out_text ?? "" }
    fields[CAMPAIGN_SMS_ROOM_FIELD] = String(
      Math.floor(smsRoom(end.shop, end.opt_out) * ASKED_SHARE)
    )
  }
  const prompt = buildPrompt({
    instruction,
    fields,
    maxLengths: factLengthsOf(task, AI_FACT_MAX_LENGTHS),
  })
  return {
    system: prompt.system,
    data: prompt.data,
    campaign: { kind: "campaign", numbers, sms: end },
  }
}
