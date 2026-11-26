import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { LINKED_COLUMNS, LINKED_KINDS } from "../../lib/catalog/linked-products"

type Column = (typeof LINKED_COLUMNS)[keyof typeof LINKED_COLUMNS]

export type LinkedInput = Partial<Record<Column, string[] | null | undefined>>

/**
 * The linked lists a catalog save writes (S3): each sent list checked
 * (never the product itself, every product there) and an empty one kept
 * as none. A draft may be linked: the storefront skips it until it is
 * published. Lists left out are left out.
 */
export async function linkedToWrite(
  container: Pick<MedusaContainer, "resolve">,
  productId: string,
  input: LinkedInput
): Promise<LinkedInput> {
  const sent = LINKED_KINDS.map((kind) => LINKED_COLUMNS[kind]).filter(
    (column) => input[column] !== undefined
  )
  const ids = new Set(sent.flatMap((column) => input[column] ?? []))
  for (const column of sent) {
    if (input[column]?.includes(productId)) {
      throw new ValidationError("catalog.linked_self", { field: column })
    }
  }
  if (ids.size > 0) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { id: [...ids] },
    })
    const found = new Set((data as { id: string }[]).map((row) => row.id))
    const missing = sent.find((column) => (input[column] ?? []).some((id) => !found.has(id)))
    if (missing) {
      throw new ValidationError("catalog.linked_unknown", { field: missing })
    }
  }
  return Object.fromEntries(
    sent.map((column) => {
      const list = input[column] ?? []
      return [column, list.length > 0 ? list : null]
    })
  )
}

export interface LinkedProductRow {
  id: string
  title: string
  handle: string
  status: string
  thumbnail: string | null
}

/**
 * The linked lists as the admin shows them, in the shop's order: each
 * product's name, address, status and picture. One deleted since is left
 * out (the next save drops it); a draft stays, marked by its status.
 */
export async function linkedForAdmin(
  container: Pick<MedusaContainer, "resolve">,
  lists: { upsell: readonly string[]; cross_sell: readonly string[] }
): Promise<{ upsells: LinkedProductRow[]; cross_sells: LinkedProductRow[] }> {
  const ids = [...new Set([...lists.upsell, ...lists.cross_sell])]
  if (ids.length === 0) {
    return { upsells: [], cross_sells: [] }
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "status", "thumbnail"],
    filters: { id: ids },
  })
  const byId = new Map(
    (data as LinkedProductRow[]).map((row) => [
      row.id,
      {
        id: row.id,
        title: row.title,
        handle: row.handle,
        status: row.status,
        thumbnail: row.thumbnail ?? null,
      },
    ])
  )
  const rows = (list: readonly string[]) => list.flatMap((id) => byId.get(id) ?? [])
  return { upsells: rows(lists.upsell), cross_sells: rows(lists.cross_sell) }
}
