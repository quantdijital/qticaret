import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { VatRate, VatState, VatType } from "../../lib/tax"

// A region's rates, the removed ones included; and the shop's product types,
// reserved for KDV (adr/0007), so a few
const MAX_ROWS = 500

interface RuleRow {
  reference: string
  reference_id: string
  deleted_at?: Date | string | null
}

const time = (value: Date | string | null | undefined): number =>
  value ? new Date(value).getTime() : 0

/**
 * A rate's product type: its standing rule's; a removed rate's, the rule
 * removed with it (the latest one, should Medusa's rule update have left
 * older ones).
 */
function typeIdOf(rules: readonly RuleRow[], active: boolean): string | null {
  const own = rules
    .filter((rule) => rule.reference === "product_type")
    .filter((rule) => (active ? !rule.deleted_at : true))
    .sort((a, b) => time(b.deleted_at) - time(a.deleted_at))
  return own[0]?.reference_id ?? null
}

/** The rates of the shop's KDV region and the product types they and others stand on. */
export async function vatStateOf(container: MedusaContainer, regionId: string): Promise<VatState> {
  const tax = container.resolve(Modules.TAX)
  const products = container.resolve(Modules.PRODUCT)
  const rows = await tax.listTaxRates(
    { tax_region_id: regionId },
    { relations: ["rules"], withDeleted: true, take: MAX_ROWS, order: { created_at: "ASC" } }
  )
  const rates: VatRate[] = rows.map((row) => {
    const active = !row.deleted_at
    return {
      id: row.id,
      code: row.code ?? null,
      name: row.name,
      rate: row.rate ?? 0,
      is_default: row.is_default,
      active,
      // The DTO leaves out the relation it was asked for
      product_type_id: typeIdOf((row as { rules?: RuleRow[] }).rules ?? [], active),
    }
  })
  const bound = [...new Set(rates.flatMap((rate) => rate.product_type_id ?? []))]
  const [standing, removed] = await Promise.all([
    products.listProductTypes({}, { select: ["id", "value"], take: MAX_ROWS }),
    bound.length > 0
      ? products.listProductTypes(
          { id: bound },
          { select: ["id", "value", "deleted_at"], withDeleted: true, take: bound.length }
        )
      : Promise.resolve([]),
  ])
  const types = new Map<string, VatType>()
  for (const type of removed) {
    types.set(type.id, { id: type.id, value: type.value, active: !type.deleted_at })
  }
  for (const type of standing) {
    types.set(type.id, { id: type.id, value: type.value, active: true })
  }
  return { rates, types: [...types.values()] }
}

/** Products on a product type, drafts included. */
export async function productsOnType(container: MedusaContainer, typeId: string): Promise<number> {
  const [, count] = await container
    .resolve(Modules.PRODUCT)
    .listAndCountProducts({ type_id: typeId }, { select: ["id"], take: 1 })
  return count
}

/** Every product of the shop, drafts included. */
export async function productTotal(container: MedusaContainer): Promise<number> {
  const [, count] = await container
    .resolve(Modules.PRODUCT)
    .listAndCountProducts({}, { select: ["id"], take: 1 })
  return count
}
