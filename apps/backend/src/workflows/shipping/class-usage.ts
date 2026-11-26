import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Products per shipping class (adr/0087 §4); a class nobody uses is left out. */
export async function shippingClassUsage(
  container: Pick<MedusaContainer, "resolve">
): Promise<Record<string, number>> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_extension",
    fields: ["shipping_class"],
    filters: { shipping_class: { $ne: null } },
  })
  // A Map: a key such as `constructor` counts like any other
  const usage = new Map<string, number>()
  for (const row of data as unknown as { shipping_class?: string | null }[]) {
    if (row.shipping_class) {
      usage.set(row.shipping_class, (usage.get(row.shipping_class) ?? 0) + 1)
    }
  }
  return Object.fromEntries(usage)
}
