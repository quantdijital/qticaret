import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import {
  planNewVatRate,
  planVatDefault,
  planVatRemoval,
  planVatRename,
  planVatRestore,
  rateOf,
} from "../../../lib/tax"
import type {
  NewVatRatePlan,
  VatDefaultPlan,
  VatRemovalPlan,
  VatRenamePlan,
  VatRestorePlan,
  VatState,
} from "../../../lib/tax"
import { productsOnType, vatStateOf } from "../vat-state"

/**
 * What a change to the KDV rates does, read inside the rates' lock (the
 * rules are lib/tax/vat-plan.ts). Reads only: nothing to undo.
 */

export interface NewVatRateStepInput {
  region_id: string
  rate: number
  name?: string | undefined
  code?: string | undefined
}

export const planNewVatRateStep = createStep(
  "vat-rate-plan-new",
  async (input: NewVatRateStepInput, { container }) => {
    const state = await vatStateOf(container, input.region_id)
    return new StepResponse<NewVatRatePlan>(planNewVatRate(state, input))
  }
)

export interface VatRateChangeStepInput {
  region_id: string
  id: string
  name?: string | undefined
  active?: boolean | undefined
}

export interface VatChangePlan {
  removal: VatRemovalPlan | null
  restore: VatRestorePlan | null
  rename: VatRenamePlan | null
}

/** The state once the removed rate and its product type are back. */
const restored = (state: VatState, plan: VatRestorePlan): VatState => ({
  rates: state.rates.map((rate) => (rate.id === plan.rate_id ? { ...rate, active: true } : rate)),
  types: state.types.map((type) => (type.id === plan.type_id ? { ...type, active: true } : type)),
})

export const planVatRateChangeStep = createStep(
  "vat-rate-plan-change",
  async (input: VatRateChangeStepInput, { container }) => {
    const state = await vatStateOf(container, input.region_id)
    const rate = rateOf(state, input.id)
    let removal: VatRemovalPlan | null = null
    let restore: VatRestorePlan | null = null
    let after = state
    if (input.active === false) {
      const products =
        rate.active && rate.product_type_id
          ? await productsOnType(container, rate.product_type_id)
          : 0
      removal = planVatRemoval(state, input.id, products)
    } else if (input.active === true) {
      restore = planVatRestore(state, input.id)
      after = restore ? restored(state, restore) : state
    }
    const rename = input.name === undefined ? null : planVatRename(after, input.id, input.name)
    return new StepResponse<VatChangePlan>({ removal, restore, rename })
  }
)

export interface VatDefaultStepInput {
  region_id: string
  rate_id: string
}

export const planVatDefaultStep = createStep(
  "vat-rate-plan-default",
  async (input: VatDefaultStepInput, { container }) => {
    const state = await vatStateOf(container, input.region_id)
    return new StepResponse<VatDefaultPlan | null>(planVatDefault(state, input.rate_id))
  }
)
