import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { hasPriceSource, splitContactName } from "../../../lib/wholesale"
import type { CustomerNames } from "../../../lib/wholesale"
import { writeCustomerNamesStep } from "../steps/account-customer"
import { accountById, patchAccountStep, wholesale } from "../steps/account-rows"
import type { AccountPatch } from "../steps/account-rows"
import { repriceCartsStep } from "../steps/carts"
import { syncMembershipsStep } from "../steps/memberships"
import { openOwnListWorkflow } from "./own-list"

export interface UpdateAccountInput {
  id: string
  /** Null takes the level away (the own list must stay); undefined leaves it. */
  tier_id?: string | null | undefined
  /** True opens the wholesaler's own list if it has none; it is never closed here. */
  own_prices?: true | undefined
  /** The own list's rate; a rate opens the list. Null takes the rate away. */
  rate_bps?: number | null | undefined
  min_quantity?: number | null | undefined
  company_name?: string | null | undefined
  contact_name?: string | null | undefined
  updated_by: string | null
}

interface UpdatePlan {
  patch: AccountPatch
  open_list: boolean
  rate_changed: boolean
  customer_id: string | null
  /** An active account's names go to its customer record, the one source. */
  names: Partial<CustomerNames>
}

/**
 * What the change comes to, checked before anything is written: the level
 * exists, the account keeps a price source, and the names land where the
 * account's state keeps them (its own fields while pending, the customer
 * record once bound).
 */
const planUpdateStep = createStep(
  "wholesale-plan-account-update",
  async (input: UpdateAccountInput, { container }) => {
    const account = await accountById(container, input.id)
    if (input.tier_id) {
      const [tier] = await wholesale(container).listWholesaleTiers(
        { id: input.tier_id },
        { select: ["id"], take: 1 }
      )
      if (!tier) {
        throw new ValidationError("wholesale.tier_unknown", { field: "tier_id" })
      }
    }
    const hasList = account.private_price_list_id !== null
    const openList =
      !hasList &&
      (input.own_prices === true || (input.rate_bps !== undefined && input.rate_bps !== null))
    const tierAfter = input.tier_id === undefined ? (account.tier_id ?? null) : input.tier_id
    if (
      !hasPriceSource({
        tier_id: tierAfter,
        private_price_list_id: hasList || openList ? "own" : null,
      })
    ) {
      throw new ConflictError("wholesale.no_price_source")
    }
    const rateChanged = input.rate_bps !== undefined && input.rate_bps !== account.rate_bps
    const bound = account.customer_id !== null && account.status !== "pending"
    const patch: AccountPatch = {
      ...(input.tier_id !== undefined ? { tier_id: input.tier_id } : {}),
      ...(input.rate_bps !== undefined ? { rate_bps: input.rate_bps } : {}),
      ...(input.min_quantity !== undefined ? { min_quantity: input.min_quantity } : {}),
      ...(rateChanged ? { sync_requested_at: new Date() } : {}),
      ...(!bound && input.company_name !== undefined ? { company_name: input.company_name } : {}),
      ...(!bound && input.contact_name !== undefined ? { contact_name: input.contact_name } : {}),
      updated_by: input.updated_by,
    }
    const names: Partial<CustomerNames> = {}
    if (bound && input.company_name !== undefined) {
      names.company_name = input.company_name
    }
    if (bound && input.contact_name !== undefined) {
      Object.assign(names, splitContactName(input.contact_name))
    }
    const plan: UpdatePlan = {
      patch,
      open_list: openList,
      rate_changed: rateChanged,
      customer_id: bound ? (account.customer_id ?? null) : null,
      names,
    }
    return new StepResponse(plan)
  }
)

/**
 * A wholesaler changed (ADR-0068 §3): another level (its customer moves
 * group at once, open carts priced again), its own list opened, its rate
 * (the sync job writes the list again; the route queues it), its fewest
 * units, or its company and contact. Each step is undone if a later one
 * fails.
 */
export const updateAccountWorkflow = createWorkflow(
  "wholesale-update-account",
  (input: UpdateAccountInput) => {
    const lock = transform({ input }, ({ input }) => `wholesale-account:${input.id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    const plan = planUpdateStep(input)
    when("wholesale-update-own-list", { plan }, ({ plan }) => plan.open_list).then(() => {
      openOwnListWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({ account_id: input.id })),
      })
    })
    patchAccountStep(
      transform({ input, plan }, ({ input, plan }) => ({ id: input.id, patch: plan.patch }))
    )
    writeCustomerNamesStep(
      transform({ plan }, ({ plan }) => ({ customer_id: plan.customer_id, names: plan.names }))
    )
    const moved = syncMembershipsStep(
      transform({ input }, ({ input }) => ({ account_id: input.id }))
    )
    repriceCartsStep(
      transform({ plan, moved }, ({ plan, moved }) => ({
        customer_id: plan.customer_id,
        changed: moved.added + moved.removed > 0,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ input, plan }, ({ input, plan }) => ({
        id: input.id,
        rate_changed: plan.rate_changed || plan.open_list,
      }))
    )
  }
)
