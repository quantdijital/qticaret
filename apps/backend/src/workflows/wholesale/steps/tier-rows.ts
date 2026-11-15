import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../../lib/errors"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"

const wholesale = (container: MedusaContainer) =>
  container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)

/** A level's name is its group's and its list's too: taken by another level or group, refused. */
export const checkTierNameStep = createStep(
  "wholesale-check-tier-name",
  async (input: { name: string; except?: string | undefined }, { container }) => {
    const tiers = await wholesale(container).listWholesaleTiers(
      { name: input.name },
      { select: ["id"], take: 1 }
    )
    const { data: groups } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "customer_group",
      fields: ["id"],
      filters: { name: input.name },
    })
    const ownGroup = input.except
      ? (await wholesale(container).retrieveWholesaleTier(input.except)).customer_group_id
      : null
    const taken =
      tiers.some((tier) => tier.id !== input.except) ||
      (groups as { id: string }[]).some((group) => group.id !== ownGroup)
    if (taken) {
      throw new ConflictError("wholesale.tier_exists")
    }
    return new StepResponse(undefined)
  }
)

export interface TierRowInput {
  name: string
  customer_group_id: string
  price_list_id: string
  rate_bps: number | null
  min_quantity: number | null
  created_by: string | null
}

export const createTierRowStep = createStep(
  "wholesale-create-tier-row",
  async (input: TierRowInput, { container }) => {
    const tier = await wholesale(container).createWholesaleTiers({
      ...input,
      // A rate prices every variant: the sync job writes them
      sync_requested_at: input.rate_bps === null ? null : new Date(),
    })
    return new StepResponse(tier, tier.id)
  },
  async (id, { container }) => {
    if (id) {
      await wholesale(container).deleteWholesaleTiers([id])
    }
  }
)

export interface TierUpdate {
  id: string
  name?: string | undefined
  /** Null takes the rate away (its rows go); undefined leaves it. */
  rate_bps?: number | null | undefined
  min_quantity?: number | null | undefined
}

export const updateTierRowStep = createStep(
  "wholesale-update-tier-row",
  async (input: TierUpdate, { container }) => {
    const service = wholesale(container)
    const before = await service.retrieveWholesaleTier(input.id)
    const rateChanged = input.rate_bps !== undefined && input.rate_bps !== before.rate_bps
    const updated = await service.updateWholesaleTiers({
      id: input.id,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.rate_bps !== undefined ? { rate_bps: input.rate_bps } : {}),
      ...(input.min_quantity !== undefined ? { min_quantity: input.min_quantity } : {}),
      ...(rateChanged ? { sync_requested_at: new Date() } : {}),
    })
    return new StepResponse(
      { tier: updated, rate_changed: rateChanged, name_changed: updated.name !== before.name },
      {
        id: before.id,
        name: before.name,
        rate_bps: before.rate_bps,
        min_quantity: before.min_quantity,
        sync_requested_at: before.sync_requested_at,
      }
    )
  },
  async (before, { container }) => {
    if (before) {
      await wholesale(container).updateWholesaleTiers(before)
    }
  }
)

/**
 * A level taken away with its hand-entered prices; one a wholesaler is
 * still on is refused. Undone by bringing both back.
 */
export const deleteTierRowStep = createStep(
  "wholesale-delete-tier-row",
  async (input: { id: string }, { container }) => {
    const service = wholesale(container)
    const tier = await service.retrieveWholesaleTier(input.id).catch(() => null)
    if (!tier) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "wholesale.tier_unknown")
    }
    const members = await service.listWholesaleAccounts(
      { tier_id: input.id },
      { select: ["id"], take: 1 }
    )
    if (members.length > 0) {
      throw new ConflictError("wholesale.tier_in_use")
    }
    const marks = await service.listWholesaleManualPrices(
      { price_list_id: tier.price_list_id },
      { select: ["id"], take: null }
    )
    const markIds = marks.map((mark) => mark.id)
    await service.softDeleteWholesaleTiers([tier.id])
    if (markIds.length > 0) {
      await service.softDeleteWholesaleManualPrices(markIds)
    }
    return new StepResponse(
      { customer_group_id: tier.customer_group_id, price_list_id: tier.price_list_id },
      { id: tier.id, markIds }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await wholesale(container).restoreWholesaleTiers([undo.id])
      if (undo.markIds.length > 0) {
        await wholesale(container).restoreWholesaleManualPrices(undo.markIds)
      }
    }
  }
)
