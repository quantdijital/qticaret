import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../../../lib/money"
import type { MedusaAmount } from "../../../../lib/money"
import { FRAUD_GUARD_MODULE } from "../../../../modules/fraud-guard"
import type FraudGuardModuleService from "../../../../modules/fraud-guard/service"
import type { AdminGetFraudReviewsType } from "../validators"

interface OrderRow {
  id: string
  display_id: number
  email?: string | null
  total: MedusaAmount
  created_at: string | Date
}

/**
 * GET /admin/fraud/reviews (F15.6, adr/0044 §3): the orders held for a
 * person, newest first, with what the panel's queue shows of each: its
 * number, buyer, total (kuruş) and the rules that held it.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { status, limit, offset } = req.validatedQuery as AdminGetFraudReviewsType
  const [reviews, count] = await req.scope
    .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
    .listAndCountFraudReviews(
      { status },
      { order: { created_at: "DESC", id: "DESC" }, skip: offset, take: limit }
    )
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "created_at"],
    filters: { id: reviews.map((review) => review.order_id) },
  })
  const orders = new Map((data as unknown as OrderRow[]).map((order) => [order.id, order]))
  res.json({
    reviews: reviews.map((review) => {
      const order = orders.get(review.order_id)
      return {
        id: review.id,
        status: review.status,
        score: review.score,
        reasons: (review.reasons as { reasons?: unknown } | null)?.reasons ?? [],
        note: review.note,
        decided_at: review.decided_at,
        created_at: review.created_at,
        order: order
          ? {
              id: order.id,
              display_id: order.display_id,
              email: order.email ?? null,
              total: fromMedusaAmount(order.total, { allowRounding: true }),
              created_at: order.created_at,
            }
          : null,
      }
    }),
    count,
    limit,
    offset,
  })
}
