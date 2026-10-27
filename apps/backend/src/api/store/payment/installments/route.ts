import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../lib/money"
import { installmentsFor } from "../../../../workflows/payments/installments"
import type { StoreGetInstallmentsType } from "./validators"

/**
 * `GET /store/payment/installments` (F5 V6): the installment table for a
 * cart, or for a variant in a region, as exact lira. The amount comes
 * from the server; nothing personal.
 */
export const GET = async (
  req: MedusaStoreRequest<unknown, StoreGetInstallmentsType>,
  res: MedusaResponse
) => {
  const query = req.validatedQuery as StoreGetInstallmentsType
  const target = query.cart_id
    ? { cart_id: query.cart_id }
    : { variant_id: query.variant_id ?? "", region_id: query.region_id ?? "" }
  const table = await installmentsFor(
    req.scope,
    target,
    req.publishable_key_context.sales_channel_ids
  )
  res.json({
    installments: {
      enabled: table.enabled,
      amount: toMedusaAmount(table.amount),
      currency_code: table.currency_code,
      max_count: table.max_count,
      families: table.families.map((family) => ({
        family: family.family,
        options: family.options.map((option) => ({
          count: option.count,
          rate: option.rate,
          total: toMedusaAmount(option.total),
          per_installment: toMedusaAmount(option.per_installment),
        })),
      })),
    },
  })
}
