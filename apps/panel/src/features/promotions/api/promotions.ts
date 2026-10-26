import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
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

// The detail also reads where it applies and when (F4.4): its rules and the campaign's budget
const DETAIL_FIELDS = [
  FIELDS,
  "rules.id",
  "rules.attribute",
  "rules.operator",
  "rules.values.value",
  "application_method.target_rules.id",
  "application_method.target_rules.attribute",
  "application_method.target_rules.operator",
  "application_method.target_rules.values.value",
  "campaign.budget.id",
  "campaign.budget.type",
  "campaign.budget.attribute",
  "campaign.budget.limit",
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
    queryFn: async () =>
      (await sdk.admin.promotion.retrieve(id, { fields: DETAIL_FIELDS })).promotion,
  })

export type Promotion = Awaited<ReturnType<typeof sdk.admin.promotion.retrieve>>["promotion"]

// A campaign's promotions are read from the campaign: the promotion's own query leaves them out
export async function campaignMembers(campaignId: string) {
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
export function useDeletePromotion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (promotion: Promotion) => {
      const campaignId = promotion.campaign?.id
      // Read before the promotion goes, while it still counts as a member
      const members = campaignId ? await campaignMembers(campaignId) : null
      await sdk.admin.promotion.delete(promotion.id)
      if (campaignId && ownsCampaign(promotion.id, members)) {
        await sdk.admin.campaign.delete(campaignId)
      }
    },
    onSuccess: async () => {
      // The list only: the page still shows the promotion until it leaves, and
      // reading it again would answer 404
      await client.invalidateQueries({ queryKey: ["promotions", "list"] })
    },
  })
}
