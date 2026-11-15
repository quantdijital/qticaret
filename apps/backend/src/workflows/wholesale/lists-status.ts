import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"

export type ListStatus = "active" | "draft"

/**
 * The wholesale price lists' statuses as one comparable value: two reads
 * that differ mean the flag turned between them.
 */
export async function wholesaleListsState(container: MedusaContainer): Promise<string> {
  const owned = await container.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds()
  const ids = [...owned.priceListIds]
  if (ids.length === 0) {
    return ""
  }
  const lists = await container
    .resolve(Modules.PRICING)
    .listPriceLists({ id: ids }, { select: ["id", "status"], take: null })
  return lists
    .map((list) => `${list.id}:${String(list.status)}`)
    .sort()
    .join(",")
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
