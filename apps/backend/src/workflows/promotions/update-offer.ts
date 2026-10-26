import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  batchPromotionRulesWorkflow,
  createCampaignsWorkflow,
  updateCampaignsWorkflow,
  updatePromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { EMPTY_BATCH, MINIMUM_ATTRIBUTE, PER_CUSTOMER_ATTRIBUTE, planOffer } from "./offer-plan"
import type { OfferState, UpdateOfferInput } from "./offer-plan"

export type { OfferRule, UpdateOfferInput } from "./offer-plan"

const ruleIds = (rules: ({ id: string; attribute?: string | null } | null)[] | null | undefined) =>
  (rules ?? []).flatMap((rule) => (rule ? [rule] : []))

/** The promotion as it is: its rules' ids, and whether its campaign is its own. */
const readOfferStep = createStep(
  "promotion-offer-read",
  async (input: { id: string }, { container }) => {
    const promotions = container.resolve(Modules.PROMOTION)
    const [promotion] = await promotions.listPromotions(
      { id: [input.id] },
      {
        relations: [
          "rules",
          "application_method.target_rules",
          "application_method.buy_rules",
          "campaign",
          "campaign.budget",
        ],
        take: 1,
      }
    )
    if (!promotion) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "promotions.unknown")
    }
    const campaignId = promotion.campaign?.id ?? null
    const members = campaignId
      ? await promotions.listPromotions(
          { campaign: { id: [campaignId] } },
          {
            select: ["id"],
            take: 2,
          }
        )
      : []
    const budget = promotion.campaign?.budget
    const state: OfferState = {
      target_rule_ids: ruleIds(promotion.application_method?.target_rules).map((rule) => rule.id),
      buy_rule_ids: ruleIds(promotion.application_method?.buy_rules).map((rule) => rule.id),
      minimum_rule_ids: ruleIds(promotion.rules)
        .filter((rule) => rule.attribute === MINIMUM_ATTRIBUTE)
        .map((rule) => rule.id),
      campaign_id: campaignId,
      owns_campaign: members.every((member) => member.id === input.id),
      per_customer_budget:
        budget?.type === "use_by_attribute" && budget.attribute === PER_CUSTOMER_ATTRIBUTE,
      has_budget: Boolean(budget),
    }
    return new StepResponse(state)
  }
)

/**
 * A promotion's changes in one go (F4.4/F4.5, ADR-0024): its code, limit
 * and value; the items it applies to and its "X al Y öde" rules; its basket
 * minimum; its campaign's days and per-customer limit, the campaign made if
 * it had none. Medusa's own workflows do each part and undo it when a
 * later part fails, so no half-saved offer is left live.
 */
export const updateOfferWorkflow = createWorkflow(
  "promotion-offer-update",
  (input: UpdateOfferInput) => {
    const state = readOfferStep({ id: input.id })
    const plan = transform({ input, state }, (data) => planOffer(data.input, data.state))
    updatePromotionsWorkflow
      .runAsStep({ input: transform({ plan }, (data) => data.plan.fields) })
      .config({ name: "promotion-offer-fields" })
    when({ plan }, (data) => data.plan.itemRules !== null).then(() => {
      batchPromotionRulesWorkflow
        .runAsStep({ input: transform({ plan }, (data) => data.plan.itemRules ?? EMPTY_BATCH) })
        .config({ name: "promotion-offer-item-rules" })
    })
    when({ plan }, (data) => data.plan.targetType !== null).then(() => {
      updatePromotionsWorkflow
        .runAsStep({
          input: transform({ plan }, (data) => data.plan.targetType ?? { promotionsData: [] }),
        })
        .config({ name: "promotion-offer-target-type" })
    })
    when({ plan }, (data) => data.plan.basketRules !== null).then(() => {
      batchPromotionRulesWorkflow
        .runAsStep({ input: transform({ plan }, (data) => data.plan.basketRules ?? EMPTY_BATCH) })
        .config({ name: "promotion-offer-basket-rules" })
    })
    when({ plan }, (data) => data.plan.buyRules !== null).then(() => {
      batchPromotionRulesWorkflow
        .runAsStep({ input: transform({ plan }, (data) => data.plan.buyRules ?? EMPTY_BATCH) })
        .config({ name: "promotion-offer-buy-rules" })
    })
    when({ plan }, (data) => data.plan.minimum !== null).then(() => {
      batchPromotionRulesWorkflow
        .runAsStep({ input: transform({ plan }, (data) => data.plan.minimum ?? EMPTY_BATCH) })
        .config({ name: "promotion-offer-minimum" })
    })
    when({ plan }, (data) => data.plan.campaign !== null).then(() => {
      updateCampaignsWorkflow
        .runAsStep({
          input: transform({ plan }, (data) => ({
            campaignsData: data.plan.campaign ? [data.plan.campaign] : [],
          })),
        })
        .config({ name: "promotion-offer-campaign" })
    })
    when({ plan }, (data) => data.plan.newCampaign !== null).then(() => {
      const made = createCampaignsWorkflow
        .runAsStep({
          input: transform({ plan }, (data) => ({
            campaignsData: data.plan.newCampaign ? [data.plan.newCampaign] : [],
          })),
        })
        .config({ name: "promotion-offer-new-campaign" })
      updatePromotionsWorkflow
        .runAsStep({
          input: transform({ made, input }, (data) => ({
            promotionsData: [{ id: data.input.id, campaign_id: data.made[0]?.id ?? null }],
          })),
        })
        .config({ name: "promotion-offer-join-campaign" })
    })
    return new WorkflowResponse(transform({ input }, (data) => ({ id: data.input.id })))
  }
)
