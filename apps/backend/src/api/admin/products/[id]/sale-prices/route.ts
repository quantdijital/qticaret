import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fromMedusaAmount, toMedusaAmount } from "../../../../../lib/money"
import { productSaleFacts, shopCurrency } from "../../../../../workflows/pricing/variant-sale/read"
import { shownSale } from "../../../../../workflows/pricing/variant-sale/plan"
import { setVariantSalesWorkflow } from "../../../../../workflows/pricing/variant-sale/workflow"
import type { AdminPostSalePricesType } from "./validators"

/**
 * `GET /admin/products/:id/sale-prices` (adr/0086): each variant's own
 * price and its sale price, running or to come, with its days. Amounts
 * are lira ("80.00") in the shop's currency; an ended sale is none.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const currency = await shopCurrency(req.scope)
  const facts = await productSaleFacts(req.scope, req.params["id"] ?? "", currency)
  const now = new Date()
  res.json({
    currency_code: currency,
    variants: facts.variants.map((variant) => {
      const sale = shownSale(facts.existing.get(variant.id) ?? [], now)
      return {
        id: variant.id,
        regular: variant.base === null ? null : toMedusaAmount(variant.base),
        sale: sale && {
          amount: toMedusaAmount(sale.amount),
          starts_at: sale.starts_at,
          ends_at: sale.ends_at,
          running: sale.running,
        },
      }
    }),
  })
}

/**
 * `POST /admin/products/:id/sale-prices` (adr/0086): sale prices set,
 * changed or cleared on the product's variants, all or none. A price is
 * checked against the variant's own; a percentage is worked out on the
 * server. Answers as the read does.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSalePricesType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  await setVariantSalesWorkflow(req.scope).run({
    input: {
      product_id: req.params["id"] ?? "",
      clear: body.clear,
      set: body.set.map((entry) => ({
        variant_id: entry.variant_id,
        amount: entry.amount === undefined ? null : fromMedusaAmount(entry.amount),
        rate_bps: entry.percent === undefined ? null : Math.round(entry.percent * 100),
        starts_at: entry.starts_at,
        ends_at: entry.ends_at,
      })),
    },
  })
  await GET(req, res)
}
