/** A product's catalog fields as `GET /admin/products/:id/catalog` returns them (F3.1). */
export const CONDITIONS = ["new", "refurbished", "used", "damaged"] as const
export type Condition = (typeof CONDITIONS)[number]

export interface ProductRef {
  id: string
  title: string
  handle: string
}

export interface ProductCatalog {
  condition: Condition
  kind: string
  primary_category_id: string | null
  successor: ProductRef | null
  categories: { id: string; name: string }[]
  variants: {
    id: string
    title: string | null
    sku: string | null
    mpn: string | null
    gtin: string | null
  }[]
}

export interface CatalogBody {
  condition?: Condition
  primary_category_id?: string | null
  successor_product_id?: string | null
  variants?: Record<string, { mpn: string | null }>
}
