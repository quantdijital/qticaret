import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PopupPromotion } from "../../lib/popups/eligibility"

const FIELDS = [
  "id",
  "code",
  "status",
  "is_automatic",
  "limit",
  "used",
  "campaign.starts_at",
  "campaign.ends_at",
]

/**
 * The Medusa promotions campaign pop-ups name, by id, read through Query
 * (the promotion module is Medusa's): its code, status, use limit and its
 * campaign's days decide whether the pop-up shows (adr/0080 §2). A
 * promotion that is gone is absent.
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
    (data as Partial<PopupPromotion>[]).map((row) => [
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
      },
    ])
  )
}
