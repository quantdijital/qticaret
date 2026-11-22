import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"

// A successor chain longer than this is refused as if it looped
const MAX_SUCCESSOR_CHAIN = 20

interface SuccessorRow {
  product_extension?: { successor_product_id?: string | null } | null
}

/**
 * The successor is where the product's URL points once it is no longer sold
 * (docs/13 §2.4): another existing product, and following successors from
 * it never comes back to this one (a redirect loop).
 */
export async function checkSuccessor(
  container: MedusaContainer,
  productId: string,
  successorId: string
): Promise<void> {
  if (successorId === productId) {
    throw new ValidationError("catalog.successor_self", { field: "successor_product_id" })
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  let current = successorId
  for (let step = 0; step < MAX_SUCCESSOR_CHAIN; step += 1) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "product_extension.successor_product_id"],
      filters: { id: current },
    })
    const row = data[0] as SuccessorRow | undefined
    if (!row) {
      if (step === 0) {
        throw new ValidationError("catalog.successor_unknown", { field: "successor_product_id" })
      }
      // A deleted product further down ends the chain
      return
    }
    const next = row.product_extension?.successor_product_id
    if (!next) {
      return
    }
    if (next === productId) {
      break
    }
    current = next
  }
  throw new ValidationError("catalog.successor_loop", { field: "successor_product_id" })
}
