import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PopupPromotion } from "../../lib/popups/eligibility"
import { PAYMENT_LINK_CAMPAIGN } from "../payment-links/promotion"
import { BATCH_PREFIX } from "../promotions/code-batches"

const FIELDS = [
  "id",
  "code",
  "status",
  "is_automatic",
  "limit",
  "used",
  "campaign.campaign_identifier",
  "campaign.starts_at",
  "campaign.ends_at",
]

interface PromotionRow {
  id?: string
  code?: string | null
  status?: string | null
  is_automatic?: boolean | null
  limit?: number | null
  used?: number | null
  campaign?: {
    campaign_identifier?: string | null
    starts_at?: Date | string | null
    ends_at?: Date | string | null
  } | null
}

/**
 * Whether a pop-up may publish the promotion's code (adr/0080 §2): never
 * one meant for a single person: a single-use batch's copy (its campaign
 * is the batch's, `codes-…`), a payment link's own code, or any promotion
 * used at most once.
 */
export function isLinkablePromotion(row: {
  limit?: number | null
  campaign?: { campaign_identifier?: string | null } | null
}): boolean {
  const identifier = row.campaign?.campaign_identifier ?? ""
  if (identifier.startsWith(BATCH_PREFIX) || identifier === PAYMENT_LINK_CAMPAIGN) {
    return false
  }
  return row.limit !== 1
}

/**
 * The Medusa promotions campaign pop-ups name, by id, read through Query
 * (the promotion module is Medusa's): its code, status, use limit and its
 * campaign's days decide whether the pop-up shows (adr/0080 §2), and
 * `linkable` whether it may at all. A promotion that is gone is absent.
 */
export async function promotionsById(
  container: Pick<MedusaContainer, "resolve">,
  ids: readonly string[]
): Promise<Map<string, PopupPromotion>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "promotion",
    fields: FIELDS,
    filters: { id: unique },
  })
  return new Map(
    (data as PromotionRow[]).map((row) => [
      row.id ?? "",
      {
        id: row.id ?? "",
        code: row.code ?? null,
        status: row.status ?? null,
        is_automatic: row.is_automatic ?? null,
        limit: row.limit ?? null,
        used: row.used ?? null,
        campaign: row.campaign
          ? { starts_at: row.campaign.starts_at ?? null, ends_at: row.campaign.ends_at ?? null }
          : null,
        linkable: isLinkablePromotion(row),
      },
    ])
  )
}
