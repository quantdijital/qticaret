import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../../lib/logging"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"

export type ListStatus = "active" | "draft"

/** A list's last write in milliseconds; null when it cannot be read. */
function writtenAt(value: Date | string | null | undefined): number | null {
  const at = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(at) ? at : null
}

/**
 * The wholesale price lists' statuses and last writes as one comparable
 * value: two reads that differ mean a list changed between them, even a
 * flag turned off and on again (the statuses alone would read the same).
 * Null when a list's last write cannot be read (#93 review D4): the
 * statuses alone could not tell such a turn, so the caller counts the
 * pass as unsettled rather than comparing less.
 */
export async function wholesaleListsState(
  container: Pick<MedusaContainer, "resolve">
): Promise<string | null> {
  const owned = await container.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds()
  const ids = [...owned.priceListIds]
  if (ids.length === 0) {
    return ""
  }
  // Through the query: the pricing module's list DTO does not carry `updated_at`
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "price_list",
    fields: ["id", "status", "updated_at"],
    filters: { id: ids },
  })
  const lists = data as { id: string; status: unknown; updated_at?: Date | string | null }[]
  const states: string[] = []
  for (const list of lists) {
    const at = writtenAt(list.updated_at)
    if (at === null) {
      logger.warn({ event: "wholesale.lists_state_unread", price_list_id: list.id })
      return null
    }
    states.push(`${list.id}:${String(list.status)}:${String(at)}`)
  }
  return states.sort().join(",")
}

/**
 * Sets the wholesale price lists' status (all of them, or these): drafts
 * price no one. Returns the lists it changed with their status before,
 * for an undo.
 */
export async function setWholesaleListsStatus(
  container: MedusaContainer,
  status: ListStatus,
  only?: readonly string[]
): Promise<{ id: string; before: ListStatus }[]> {
  const owned = await container.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds()
  const ids = [...owned.priceListIds].filter((id) => !only || only.includes(id))
  if (ids.length === 0) {
    return []
  }
  const pricing = container.resolve(Modules.PRICING)
  const lists = await pricing.listPriceLists({ id: ids }, { select: ["id", "status"], take: null })
  const changing = lists
    .filter((list) => list.status !== status)
    .map((list): { id: string; before: ListStatus } => ({
      id: list.id,
      before: list.status === "active" ? "active" : "draft",
    }))
  if (changing.length > 0) {
    await pricing.updatePriceLists(changing.map(({ id }) => ({ id, status })))
  }
  return changing
}
