import type {
  ICartModuleService,
  IOrderModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { withoutAddonTexts } from "../../lib/catalog/addons"

type Container = Pick<MedusaContainer, "resolve">

type ItemRow = { id: string; metadata?: Record<string, unknown> | null } | null

/**
 * The texts the buyer typed on these orders' add-on lines, and their
 * carts' lines, erased (adr/0052 §10, docs/kvkk-envanter.md): a text can
 * be a person's name. The add-on's name and price stay for the books;
 * run again, it changes nothing more.
 */
export async function eraseAddonTexts(
  container: Container,
  orderIds: readonly string[]
): Promise<number> {
  if (orderIds.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.id", "items.metadata", "cart.id"],
    filters: { id: [...orderIds] },
  })
  const rows = data as { items?: ItemRow[] | null; cart?: { id?: string } | null }[]
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  let erased = 0
  for (const item of rows.flatMap((row) => row.items ?? [])) {
    const metadata = item ? withoutAddonTexts(item.metadata) : null
    if (item && metadata) {
      await orders.updateOrderLineItems(item.id, { metadata })
      erased += 1
    }
  }
  const cartIds = rows.flatMap((row) => (row.cart?.id ? [row.cart.id] : []))
  if (cartIds.length > 0) {
    const carts = container.resolve<ICartModuleService>(Modules.CART)
    const lines = await carts.listLineItems(
      { cart_id: cartIds },
      { select: ["id", "metadata"], take: null }
    )
    for (const line of lines) {
      const metadata = withoutAddonTexts(line.metadata)
      if (metadata) {
        await carts.updateLineItems(line.id, { metadata })
      }
    }
  }
  return erased
}
