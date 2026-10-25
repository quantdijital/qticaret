import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { createBody } from "../form"
import { ownsCampaign } from "../offer"

// A shop runs a handful at a time: one read holds them, tabs filter here
export const PROMOTIONS_READ = 200

const FIELDS = [
  "id",
  "code",
  "status",
  "is_automatic",
  "type",
  "limit",
  "used",
  "created_at",
  "application_method.id",
  "application_method.type",
  "application_method.target_type",
  "application_method.value",
  "application_method.currency_code",
  "campaign.id",
  "campaign.starts_at",
  "campaign.ends_at",
].join(",")

export const promotionsQuery = () =>
  queryOptions({
    queryKey: ["promotions", "list"],
    queryFn: () =>
      sdk.admin.promotion.list({ fields: FIELDS, limit: PROMOTIONS_READ, order: "-created_at" }),
  })

export const promotionQuery = (id: string) =>
  queryOptions({
    queryKey: ["promotions", "detail", id],
    queryFn: async () => (await sdk.admin.promotion.retrieve(id, { fields: FIELDS })).promotion,
  })

export type Promotion = Awaited<ReturnType<typeof sdk.admin.promotion.retrieve>>["promotion"]

// A campaign's promotions are read from the campaign: the promotion's own query leaves them out
async function campaignMembers(campaignId: string) {
  const { campaign } = await sdk.admin.campaign.retrieve(campaignId, { fields: "id,promotions.id" })
  return (campaign as { promotions?: ({ id: string } | null)[] | null }).promotions
}

/** Who else is in the promotion's campaign, to tell whether its dates are the promotion's own. */
export const campaignMembersQuery = (campaignId: string) =>
  queryOptions({
    queryKey: ["promotions", "campaign-members", campaignId],
    queryFn: () => campaignMembers(campaignId),
  })

function usePromotionMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["promotions"] })
    },
  })
}

export const useUpdatePromotion = (id: string) =>
  usePromotionMutation((body: Parameters<typeof sdk.admin.promotion.update>[1]) =>
    sdk.admin.promotion.update(id, body)
  )

/** Deletes the promotion, and its campaign when that held only this promotion's dates. */
export const useDeletePromotion = () =>
  usePromotionMutation(async (promotion: Promotion) => {
    const campaignId = promotion.campaign?.id
    // Read before the promotion goes, while it still counts as a member
    const members = campaignId ? await campaignMembers(campaignId) : null
    await sdk.admin.promotion.delete(promotion.id)
    if (campaignId && ownsCampaign(promotion.id, members)) {
      await sdk.admin.campaign.delete(campaignId)
    }
  })

interface SaveInput {
  existing: Promotion | null
  body: ReturnType<typeof createBody>
}

/**
 * A new promotion in one call; an existing one gets its code, limit and
 * value, and its dates on its campaign (made now if it had none).
 */
export function useSavePromotion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ existing, body }: SaveInput): Promise<string> => {
      if (!existing) {
        return (await sdk.admin.promotion.create(body)).promotion.id
      }
      const methodId = existing.application_method?.id
      await sdk.admin.promotion.update(existing.id, {
        code: body.code,
        is_automatic: body.is_automatic,
        limit: body.limit,
        ...(methodId && body.application_method.target_type === "order"
          ? { application_method: { value: body.application_method.value } }
          : {}),
      })
      const dates = {
        starts_at: body.campaign?.starts_at ?? null,
        ends_at: body.campaign?.ends_at ?? null,
      }
      // A campaign other promotions share keeps its dates (and budget) as they are
      if (existing.campaign?.id) {
        if (ownsCampaign(existing.id, await campaignMembers(existing.campaign.id))) {
          await sdk.admin.campaign.update(existing.campaign.id, dates)
        }
      } else if (body.campaign) {
        const { campaign } = await sdk.admin.campaign.create(body.campaign)
        await sdk.admin.promotion.update(existing.id, { campaign_id: campaign.id })
      }
      return existing.id
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["promotions"] })
    },
  })
}
