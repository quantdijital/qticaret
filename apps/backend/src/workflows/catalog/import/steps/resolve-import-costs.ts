import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { CostLine } from "../plan-variants"
import { keyedVariants } from "./keyed-variants"

/**
 * The unit costs a sheet gives (F11.4), by variant id as the catalog save
 * takes them: a variant this import made is found by its option values.
 * Reads only; the catalog workflow writes and undoes.
 */
export const resolveImportCostsStep = createStep(
  "catalog-import-resolve-costs",
  async (input: { product_id: string; costs: CostLine[] }, { container }) => {
    const costs: Record<string, { cost: number }> = {}
    if (input.costs.length === 0) {
      return new StepResponse(costs)
    }
    const variants = await keyedVariants(container, input.product_id)
    for (const line of input.costs) {
      const variant = variants.find((each) =>
        line.variantId ? each.id === line.variantId : each.key === line.key
      )
      if (variant) {
        costs[variant.id] = { cost: line.cost }
      }
    }
    return new StepResponse(costs)
  }
)
