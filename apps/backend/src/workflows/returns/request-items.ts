import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { excludedLines } from "./policy"

type Container = Pick<MedusaContainer, "resolve">

interface RequestLine {
  line_item_id: string
  quantity: number
}

export type MarkedRequestLine = RequestLine & { withdrawal_excluded: boolean }

type OrderLine = { id: string; product_id?: string | null; metadata?: unknown } | null

const linesOf = (items: unknown): RequestLine[] =>
  Array.isArray(items) ? (items as RequestLine[]) : []

/**
 * Requests with each asked-for line marked when it is outside the right of
 * withdrawal, by the rule the returnable lines use (`excludedLines`: the
 * product's mark, F13.6, or a line's add-on, adr/0052 §8): staff see the
 * line that may come back only as faulty or wrong.
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
  const excluded = await excludedLines(
    container,
    (data as { items?: OrderLine[] | null }[]).flatMap((order) => order.items ?? [])
  )
  return requests.map((request) => ({
    ...request,
    items: linesOf(request.items).map((line) => ({
      ...line,
      withdrawal_excluded: excluded.has(line.line_item_id),
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
