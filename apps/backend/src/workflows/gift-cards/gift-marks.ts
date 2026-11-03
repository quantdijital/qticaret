import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { soldAsGiftCard } from "../../lib/promotions/gift-sale"

/*
 * Gift card marks read by product and by order line (adr/0025 Ek
 * 2026-11-03). Apart from `gift-products.ts`, which loads a module link:
 * what invoices, the accounting package and returns import stays free of it.
 */

type Container = Pick<MedusaContainer, "resolve">

/** Which of these products are marked as gift cards (adr/0025 Ek 2026-11-03). */
export async function giftProductsAmong(
  container: Container,
  productIds: readonly (string | null | undefined)[]
): Promise<Set<string>> {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) {
    return new Set()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.is_gift_card"],
    filters: { id: ids },
  })
  return new Set(
    (data as { id: string; product_extension?: { is_gift_card?: boolean | null } | null }[])
      .filter((row) => row.product_extension?.is_gift_card === true)
      .map((row) => row.id)
  )
}

/**
 * Which of these order lines are gift card lines: their product marked
 * (as issuing reads them) or their record saying they were sold as one
 * (`soldAsGiftCard`), the product's mark taken off since. Their money is
 * an advance, not a sale (docs/mali-musavir-sorulari.md 3.2).
 */
export async function giftLineIdsOf(
  container: Container,
  items: readonly ({ id: string; product_id?: string | null; metadata?: unknown } | null)[]
): Promise<Set<string>> {
  const present = items.filter((item): item is NonNullable<typeof item> => item !== null)
  const marked = await giftProductsAmong(
    container,
    present.map((item) => item.product_id)
  )
  return new Set(
    present
      .filter(
        (item) =>
          Boolean(item.product_id && marked.has(item.product_id)) || soldAsGiftCard(item.metadata)
      )
      .map((item) => item.id)
  )
}
