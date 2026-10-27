import { kurus, toMedusaAmount } from "../../../lib/money"

/** A dispute as the panel reads it: its amount as exact lira ("120.50"), like every order amount. */
export const chargebackView = <T extends { amount: number }>(chargeback: T) => ({
  ...chargeback,
  amount: toMedusaAmount(kurus(chargeback.amount)),
})
