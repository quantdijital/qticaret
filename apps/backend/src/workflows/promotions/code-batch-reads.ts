import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { BATCH_PREFIX, templateOfBatch } from "./code-batches"

interface CampaignRow {
  id: string
  campaign_identifier: string
  created_at: Date | string
}

// Medusa's filters take MikroORM operators; its types name only plain values
type Filters = Record<string, unknown>

/** Every batch campaign, or a template's (identifiers start with its id). */
async function batchCampaigns(container: MedusaContainer, templateId?: string) {
  const like = templateId ? `${BATCH_PREFIX}${templateId}-%` : `${BATCH_PREFIX}%`
  return (await container
    .resolve(Modules.PROMOTION)
    .listCampaigns({ campaign_identifier: { $like: like } } as Filters, {
      select: ["id", "campaign_identifier", "created_at"],
      take: null,
    })) as unknown as CampaignRow[]
}

/**
 * The promotions list (F4.6): the shop's own promotions, newest first,
 * without the copies batches of single-use codes hold (thousands), and how
 * many batches each template has.
 */
export async function promotionBoard(container: MedusaContainer, fields: string[], take: number) {
  const batches = await batchCampaigns(container)
  const batchIds = batches.map((campaign) => campaign.id)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "promotion",
    fields,
    filters:
      batchIds.length === 0
        ? {}
        : { $or: [{ campaign_id: null }, { campaign_id: { $nin: batchIds } }] },
    pagination: { take, order: { created_at: "DESC" } },
  })
  const counts: Record<string, number> = {}
  for (const campaign of batches) {
    const template = templateOfBatch(campaign.campaign_identifier)
    if (template) {
      counts[template] = (counts[template] ?? 0) + 1
    }
  }
  return { promotions: data, batch_counts: counts }
}

export interface CodeBatchSummary {
  campaign_id: string
  created_at: Date | string
  count: number
  used: number
}

/** A template's batches, newest first: how many codes each holds and how many were used. */
export async function codeBatchesOf(
  container: MedusaContainer,
  templateId: string
): Promise<CodeBatchSummary[]> {
  const promotions = container.resolve(Modules.PROMOTION)
  const campaigns = await batchCampaigns(container, templateId)
  const summaries = await Promise.all(
    campaigns.map(async (campaign) => {
      const rows = await promotions.listPromotions(
        { campaign: { id: [campaign.id] } },
        { select: ["id", "used"], take: null }
      )
      return {
        campaign_id: campaign.id,
        created_at: campaign.created_at,
        count: rows.length,
        used: rows.filter((row) => (row.used ?? 0) > 0).length,
      }
    })
  )
  return summaries.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/** A batch's codes and whether each was used, for its CSV; the batch must be the template's. */
export async function batchCodes(
  container: MedusaContainer,
  templateId: string,
  campaignId: string
) {
  const promotions = container.resolve(Modules.PROMOTION)
  const [campaign] = (await promotions.listCampaigns(
    { id: [campaignId] },
    { select: ["id", "campaign_identifier"], take: 1 }
  )) as unknown as CampaignRow[]
  if (!campaign || templateOfBatch(campaign.campaign_identifier) !== templateId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "promotions.unknown")
  }
  const rows = await promotions.listPromotions(
    { campaign: { id: [campaignId] } },
    { select: ["code", "used"], take: null, order: { code: "ASC" } }
  )
  return rows.map((row) => ({ code: row.code ?? "", used: (row.used ?? 0) > 0 }))
}
