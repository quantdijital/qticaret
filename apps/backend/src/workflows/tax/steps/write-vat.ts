import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { VatRestorePlan } from "../../../lib/tax"

/**
 * The writes Medusa has no workflow for (adr/0007, the KDV screen): a
 * removed rate brought back, and the default moved from one rate to
 * another. Each step undoes itself; a step that fails half-way undoes its
 * own first half before it throws, as its compensation would not run.
 */

const taxOf = (container: MedusaContainer) => container.resolve(Modules.TAX)
const productsOf = (container: MedusaContainer) => container.resolve(Modules.PRODUCT)

/** A removed rate back with its rules (the tax module restores them with it) and its product type. */
export const restoreVatRateStep = createStep(
  "vat-rate-restore",
  async (plan: VatRestorePlan | null, { container }) => {
    if (!plan) {
      return new StepResponse(null, null)
    }
    await taxOf(container).restoreTaxRates([plan.rate_id])
    if (plan.type_id) {
      try {
        await productsOf(container).restoreProductTypes([plan.type_id])
      } catch (error) {
        await taxOf(container).softDeleteTaxRates([plan.rate_id])
        throw error
      }
    }
    return new StepResponse(plan, plan)
  },
  async (plan, { container }) => {
    if (!plan) {
      return
    }
    if (plan.type_id) {
      await productsOf(container).softDeleteProductTypes([plan.type_id])
    }
    await taxOf(container).softDeleteTaxRates([plan.rate_id])
  }
)

interface Rule {
  reference: string
  reference_id: string
}

export interface UnsetDefaultInput {
  id: string
  /** The product type the old default is bound to from now on; null when it is bound already. */
  bind_type_id: string | null
}

interface UnsetDefaultUndo {
  id: string
  /** Its rules before, given back when it is the default again. */
  rules: Rule[]
}

const rulesOf = async (container: MedusaContainer, id: string): Promise<Rule[]> => {
  const [rate] = await taxOf(container).listTaxRates({ id }, { relations: ["rules"], take: 1 })
  // The DTO leaves out the relation it was asked for
  const rules = (rate as { rules?: Rule[] } | undefined)?.rules ?? []
  return rules.map(({ reference, reference_id }) => ({ reference, reference_id }))
}

/**
 * The old default stops being it (first: one default per region) and,
 * when it was on no product type, is bound to one so products can still
 * be put on it.
 */
export const unsetVatDefaultStep = createStep(
  "vat-rate-unset-default",
  async (input: UnsetDefaultInput | null, { container }) => {
    if (!input) {
      return new StepResponse(null, null)
    }
    const rules = await rulesOf(container, input.id)
    const bound = input.bind_type_id
      ? { rules: [...rules, { reference: "product_type", reference_id: input.bind_type_id }] }
      : {}
    await taxOf(container).updateTaxRates(input.id, { is_default: false, ...bound })
    return new StepResponse(input.id, { id: input.id, rules } satisfies UnsetDefaultUndo)
  },
  async (undo, { container }) => {
    if (undo) {
      await taxOf(container).updateTaxRates(undo.id, { is_default: true, rules: undo.rules })
    }
  }
)

/** The rate products without a VAT product type are taxed at from now on. */
export const setVatDefaultStep = createStep(
  "vat-rate-set-default",
  async (id: string | null, { container }) => {
    if (!id) {
      return new StepResponse(null, null)
    }
    await taxOf(container).updateTaxRates(id, { is_default: true })
    return new StepResponse(id, id)
  },
  async (id, { container }) => {
    if (id) {
      await taxOf(container).updateTaxRates(id, { is_default: false })
    }
  }
)
