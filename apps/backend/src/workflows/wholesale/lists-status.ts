import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"

export type ListStatus = "active" | "draft"

/** A list's last write in milliseconds; none read, nothing to compare. */
const writtenAt = (value: Date | string | null | undefined): string =>
  value ? String(new Date(value).getTime()) : ""

/**
 * The wholesale price lists' statuses and last writes as one comparable
 * value: two reads that differ mean a list changed between them, even a
 * flag turned off and on again (the statuses alone would read the same).
 */
export async function wholesaleListsState(
  container: Pick<MedusaContainer, "resolve">
): Promise<string> {
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
  return lists
    .map((list) => `${list.id}:${String(list.status)}:${writtenAt(list.updated_at)}`)
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
