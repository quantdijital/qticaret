import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { WithdrawalExclusion } from "../../lib/orders/returns"
import { exclusionsOf } from "./policy"

type Container = Pick<MedusaContainer, "resolve">

interface RequestLine {
  line_item_id: string
  quantity: number
}

export type MarkedRequestLine = RequestLine & {
  withdrawal_excluded: boolean
  /** Why it is outside the right of withdrawal; null when it is not. */
  withdrawal_excluded_reason: WithdrawalExclusion | null
}

type OrderLine = { id: string; product_id?: string | null; metadata?: unknown } | null

const linesOf = (items: unknown): RequestLine[] =>
  Array.isArray(items) ? (items as RequestLine[]) : []

/**
 * Requests with each asked-for line marked when it is outside the right of
 * withdrawal, and why, by the rule the returnable lines use
 * (`exclusionsOf`: the product's mark, F13.6, a line's add-on, adr/0052
 * §8, or a gift card spent, adr/0025): staff see the line that may come
 * back only as faulty or wrong, or not at all.
 */
export async function withWithdrawalMarks<T extends { order_id: string; items: unknown }>(
  container: Container,
  requests: readonly T[]
): Promise<(Omit<T, "items"> & { items: MarkedRequestLine[] })[]> {
  const orderIds = [...new Set(requests.map((request) => request.order_id))]
  const { data } = orderIds.length
    ? await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["id", "items.id", "items.product_id", "items.metadata"],
        filters: { id: orderIds },
      })
    : { data: [] }
  const excluded = await exclusionsOf(
    container,
    (data as { items?: OrderLine[] | null }[]).flatMap((order) => order.items ?? [])
  )
  return requests.map((request) => ({
    ...request,
    items: linesOf(request.items).map((line) => ({
      ...line,
      withdrawal_excluded: excluded.has(line.line_item_id),
      withdrawal_excluded_reason: excluded.get(line.line_item_id) ?? null,
    })),
  }))
}

/** One request, its lines marked (see `withWithdrawalMarks`). */
export async function withWithdrawalMark<T extends { order_id: string; items: unknown }>(
  container: Container,
  request: T
): Promise<Omit<T, "items"> & { items: MarkedRequestLine[] }> {
  const [marked] = await withWithdrawalMarks(container, [request])
  return marked ?? { ...request, items: [] }
}
