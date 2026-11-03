import { composeSms } from "../campaigns/sms"
import { formatIban } from "../tr/iban"
import { CAMPAIGN_SAMPLE, campaignLegalLine } from "./templates/campaign"
import type { CampaignLegal, CampaignVars } from "./templates/campaign"
import type { OrderVars } from "./templates/order-placed"
import type { MessageTemplate } from "./templates/types"

/**
 * The panel's preview of a message (F9.3) as the shop will send it: its
 * samples are made up (a customer, an order), but what the shop has filled
 * in is its own (its storefront's address, legal identity, bank account,
 * the way to refuse a text). A made-up value stays only where the shop has
 * not filled the field yet. Pure; the facts are read by the caller.
 */

/** The made-up storefront the samples' links point at. */
export const SAMPLE_ORIGIN = "https://magaza.example"

/** What the shop has filled in, for the preview to show in place of the samples. */
export interface PreviewFacts {
  shopName: string
  /** The storefront's address (`brandOf().storefrontUrl`); null until one is set. */
  storefrontUrl: string | null
  /** The panel's address: a staff member's links open there. */
  panelUrl: string
  legal: CampaignLegal
  /** The line every bulk text ends with (the `marketing` settings); null until set. */
  smsOptOut: string | null
  /** The bank-transfer account; "" for a field not filled. The deadline as from now. */
  bank: { holder: string; bank: string; iban: string; deadline: string | null }
}

const SAMPLE_LINK = /^https:\/\/magaza\.example(?=$|[/?#])/

// Every sample link moved to the shop's own address, its path and query kept
function relink<T>(value: T, origin: string): T {
  if (typeof value === "string") {
    return value.replace(SAMPLE_LINK, origin.replace(/\/+$/, "")) as T
  }
  if (Array.isArray(value)) {
    return value.map((each: unknown) => relink(each, origin)) as T
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [key, relink(each, origin)])
    ) as T
  }
  return value
}

const withShopBank = (sample: OrderVars, facts: PreviewFacts): OrderVars =>
  sample.bank
    ? {
        ...sample,
        bank: {
          holder: facts.bank.holder || sample.bank.holder,
          bank: facts.bank.bank || sample.bank.bank,
          iban: facts.bank.iban ? formatIban(facts.bank.iban) : sample.bank.iban,
          deadline: facts.bank.deadline ?? sample.bank.deadline,
        },
      }
    : sample

const withShopFooter = (sample: CampaignVars, facts: PreviewFacts): CampaignVars => ({
  ...sample,
  legal: campaignLegalLine({
    company_title: facts.legal.company_title ?? CAMPAIGN_SAMPLE.legal.company_title,
    mersis: facts.legal.mersis ?? CAMPAIGN_SAMPLE.legal.mersis,
  }),
  sms: composeSms(CAMPAIGN_SAMPLE.text, facts.shopName, facts.smsOptOut ?? CAMPAIGN_SAMPLE.optOut),
})

// The templates whose samples carry the shop's own details, beside their links
const SHOP_VALUES: Readonly<Record<string, (sample: never, facts: PreviewFacts) => unknown>> = {
  "order.placed": withShopBank,
  "marketing.campaign": withShopFooter,
}

/** The template's sample with the shop's own details and links in place. */
export function previewVars<V>(template: MessageTemplate<V>, facts: PreviewFacts): V {
  // A staff member's message links to the panel, a shopper's to the storefront
  const origin = template.name.startsWith("staff.") ? facts.panelUrl : facts.storefrontUrl
  const sample = origin ? relink(template.sample, origin) : template.sample
  const fill = Object.hasOwn(SHOP_VALUES, template.name) ? SHOP_VALUES[template.name] : undefined
  return fill ? (fill(sample as never, facts) as V) : sample
}
