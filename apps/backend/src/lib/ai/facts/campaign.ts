import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cardKeys } from "../../content/cards"
import { docPlainText } from "../../content/plain"
import type { ContentDoc } from "../../content"
import { MAX_PRODUCT_CARDS } from "../../campaigns/email-doc"
import { CAMPAIGNS_MODULE } from "../../../modules/campaigns"
import type CampaignsModuleService from "../../../modules/campaigns/service"
import { aiValidationError } from "../errors"
import { CAMPAIGN_BODY_FACT_LENGTH, CAMPAIGN_PRODUCTS_FIELD } from "../registry/campaign-tasks"
import { storefrontChannelIds } from "./storefront-channels"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * A bulk message as its words' task reads it (adr/0074 §5 madde 6): what
 * the shop wrote for it and nothing about whom it goes to. Its name (the
 * shop's own label, often its offer), an e-mail's subject, preview line
 * and body words (cards, pictures and link addresses left out) or a
 * text's words, and the names of the products the e-mail shows as cards,
 * each only while published and in a storefront sales channel (#247 D2).
 * Never its audience, a recipient, a count, a send figure, a price or a
 * stock: the fields read are named here (`CAMPAIGN_FACT_FIELDS`).
 */

/** What is read of the campaign: its own words; no audience, count or person. */
export const CAMPAIGN_FACT_FIELDS = [
  "id",
  "name",
  "channel",
  "subject",
  "preheader",
  "body",
  "sms_text",
] as const

/** Only a product's name, and its status and channels' ids to hold it to the storefront's. */
export const CAMPAIGN_PRODUCT_FIELDS = ["id", "title", "status", "sales_channels.id"] as const

export type CampaignChannel = "email" | "sms"

interface CampaignRow {
  name?: string | null
  channel?: string | null
  subject?: string | null
  preheader?: string | null
  body?: unknown
  sms_text?: string | null
}

interface ProductRow {
  id: string
  title?: string | null
  status?: string | null
  sales_channels?: ({ id?: string | null } | null)[] | null
}

/** A campaign's fields for the data block, with its channel. */
export interface CampaignFacts {
  channel: CampaignChannel
  fields: RecordFacts
}

const isDoc = (value: unknown): value is ContentDoc =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { content?: unknown }).content)

/** The ids of the products the body shows as cards, in no order; the e-mail draws four at most. */
export function cardProductIds(body: unknown): string[] {
  return [...cardKeys(body)]
    .filter((key) => key.startsWith("product:"))
    .map((key) => key.slice("product:".length))
    .slice(0, MAX_PRODUCT_CARDS)
}

/** The names of those products a shopper may see: published, in a storefront channel. */
async function shownProductNames(container: FactsContainer, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return []
  }
  const channels = await storefrontChannelIds(container)
  if (channels.size === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [...CAMPAIGN_PRODUCT_FIELDS],
    filters: { id: ids },
  })
  return (data as ProductRow[]).flatMap((row) => {
    const title = row.title?.trim() ?? ""
    const shown = (row.sales_channels ?? []).some(
      (channel) => typeof channel?.id === "string" && channels.has(channel.id)
    )
    return shown && row.status === "published" && title !== "" ? [title] : []
  })
}

const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

/**
 * The campaign by its id, as the data block takes it; an id of no
 * campaign is `ai.unknown_entity`. The e-mail's fields or the text's,
 * as its channel is.
 */
export async function campaignFacts(container: FactsContainer, id: string): Promise<CampaignFacts> {
  const [row] = (await container
    .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
    .listBulkMessages({ id }, { take: 1, select: [...CAMPAIGN_FACT_FIELDS] })) as CampaignRow[]
  if (!row || (row.channel !== "email" && row.channel !== "sms")) {
    throw aiValidationError("ai.unknown_entity")
  }
  const name = text(row.name)
  if (row.channel === "sms") {
    return { channel: "sms", fields: { campaign: name, sms_text: text(row.sms_text) } }
  }
  const products = await shownProductNames(container, cardProductIds(row.body))
  const body = isDoc(row.body) ? docPlainText(row.body, CAMPAIGN_BODY_FACT_LENGTH).text : ""
  return {
    channel: "email",
    fields: {
      campaign: name,
      [CAMPAIGN_PRODUCTS_FIELD]: products.length > 0 ? products.join("; ") : null,
      subject: text(row.subject),
      preheader: text(row.preheader),
      body: text(body),
    },
  }
}
