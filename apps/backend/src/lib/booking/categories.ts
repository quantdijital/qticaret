import { paxOf } from "./cart-lines"

/** A dated product's price category as its order reads it. */
export interface CategoryRow {
  id: string
  variant_rank?: number | null
}

const rankOf = (row: CategoryRow, index: number): [number, number] => [
  typeof row.variant_rank === "number" ? row.variant_rank : Number.MAX_SAFE_INTEGER,
  index,
]

/**
 * A dated product's paying price categories in the shop's order (the
 * variants' rank, then as read), its main one first (adr/0076 Ek "kart
 * fiyatı ana kategoriden"). An infant who takes no place is not a "from"
 * price; a product whose every category takes no place still has one.
 */
export function payingCategoryIds(
  variants: readonly (CategoryRow | null | undefined)[] | null | undefined,
  paxByVariant: unknown
): string[] {
  const ordered = (variants ?? [])
    .flatMap((row, index) => (row ? [{ row, key: rankOf(row, index) }] : []))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1])
    .map(({ row }) => row.id)
  const paying = ordered.filter((id) => paxOf(paxByVariant, id) > 0)
  return paying.length > 0 ? paying : ordered
}
