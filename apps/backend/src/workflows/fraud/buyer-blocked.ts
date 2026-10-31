import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { matchesOf } from "../../lib/fraud/block"
import { FRAUD_GUARD_MODULE } from "../../modules/fraud-guard"
import type FraudGuardModuleService from "../../modules/fraud-guard/service"

interface CartRow {
  email?: string | null
  shipping_address?: { phone?: string | null } | null
  billing_address?: { phone?: string | null } | null
}

/**
 * The cart's buyer on the shop's block list stops the order (F15.6,
 * adr/0044 §4), however it is completed: a card's notice from the provider
 * too (its money then goes back, as for any cart that cannot become an
 * order). The e-mail and the phones; the visitor's address is checked
 * where there is a request.
 */
export async function assertBuyerNotBlocked(
  container: Pick<MedusaContainer, "resolve">,
  cartId: string
): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["email", "shipping_address.phone", "billing_address.phone"],
    filters: { id: cartId },
  })
  const cart = data[0] as CartRow | undefined
  if (!cart) {
    return
  }
  const blocked = await container.resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE).blockedBy(
    matchesOf(
      {
        email: cart.email,
        phones: [cart.shipping_address?.phone, cart.billing_address?.phone],
      },
      parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
    )
  )
  if (blocked) {
    throw new ValidationError("fraud.checkout_refused")
  }
}
