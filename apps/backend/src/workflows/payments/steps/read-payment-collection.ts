import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { fromMedusaAmount } from "../../../lib/money"
import type { Kurus, MedusaAmount } from "../../../lib/money"

/** The cart's payment collection as it stands now: the amount every session charges. */
export const readPaymentCollectionStep = createStep(
  "payments-read-payment-collection",
  async (cartId: string, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["payment_collection.id", "payment_collection.raw_amount"],
      filters: { id: cartId },
    })
    // Query types the raw amount loosely; it is the stored decimal Medusa charges
    const row = data[0] as unknown as
      { payment_collection?: { id: string; raw_amount: MedusaAmount } | null } | undefined
    const collection = row?.payment_collection
    if (!collection) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
    }
    const amount: Kurus = fromMedusaAmount(collection.raw_amount, { allowRounding: true })
    return new StepResponse({ id: collection.id, amount })
  }
)
