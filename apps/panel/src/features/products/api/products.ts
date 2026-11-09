import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { MEDIA_FIELDS, isMediaSettling } from "@/features/products/api/media"
import type { ProductMedia } from "@/features/products/api/media"
import type {
  KindFilter,
  MissingFilter,
  ProductSort,
  StockFilter,
} from "@/features/products/search"

export type ProductStatus = "draft" | "proposed" | "published" | "rejected"
export const PAGE_SIZE = 20

// What a list row shows: no customer data, stock through the inventory items
const LIST_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "thumbnail",
  "updated_at",
  "categories.id",
  "categories.name",
  "variants.id",
  "variants.manage_inventory",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.inventory_items.inventory.location_levels.available_quantity",
  // A gift card product's badge (adr/0025 Ek 2026-11-03): the catalog extension's mark
  "product_extension.is_gift_card",
].join(",")

/** What the list shows: its search, view and filters (`search.ts`); none of them is a page. */
export interface ProductFilters {
  q: string
  status: ProductStatus | "all"
  category?: string | undefined
  brand?: string | undefined
  stock?: StockFilter | undefined
  missing?: MissingFilter | undefined
  kind?: KindFilter | undefined
  sort?: ProductSort | undefined
}

export interface ProductListParams extends ProductFilters {
  page: number
}

// The list's orders as the server names them
const ORDER: Record<ProductSort, string> = {
  updated: "-updated_at",
  newest: "-created_at",
  oldest: "created_at",
  title: "title",
  title_desc: "-title",
  price: "price",
  price_desc: "-price",
  stock: "stock",
  stock_desc: "-stock",
}

export interface ProductBoard {
  ids: string[]
  count: number
  /** A filter over stock, prices or what is missing read only the newest products. */
  limited: boolean
}

/**
 * The ids of the products the filters hold, in the order asked
 * (`GET /admin/product-board`): Medusa's own list cannot filter by brand,
 * stock or what is missing, nor order by price or stock.
 */
export const productBoard = (filters: ProductFilters, offset: number, limit: number) =>
  sdk.client.fetch<ProductBoard>("/admin/product-board", {
    query: {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.status === "all" ? {} : { status: filters.status }),
      ...(filters.category ? { category_id: filters.category } : {}),
      ...(filters.brand ? { brand_id: filters.brand } : {}),
      ...(filters.stock ? { stock: filters.stock } : {}),
      ...(filters.missing ? { missing: filters.missing } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      order: ORDER[filters.sort ?? "updated"],
      offset,
      limit,
    },
  })

/** A page: the board's ids, then those products with what a row shows, in the board's order. */
export const productsQuery = ({ page, ...filters }: ProductListParams) =>
  queryOptions({
    queryKey: ["products", "list", { ...filters, page }],
    queryFn: async () => {
      const board = await productBoard(filters, page * PAGE_SIZE, PAGE_SIZE)
      if (board.ids.length === 0) {
        return { products: [], count: board.count, limited: board.limited }
      }
      const { products } = await sdk.admin.product.list({
        id: board.ids,
        fields: LIST_FIELDS,
        limit: board.ids.length,
      })
      const byId = new Map(products.map((product) => [product.id, product]))
      return {
        products: board.ids.flatMap((id) => byId.get(id) ?? []),
        count: board.count,
        limited: board.limited,
      }
    },
    placeholderData: keepPreviousData,
  })

export type ProductListItem = Awaited<ReturnType<typeof sdk.admin.product.list>>["products"][number]

/** Whether a listed product sells gift cards; the SDK's type does not know the extension. */
export const isGiftCardProduct = (product: ProductListItem): boolean =>
  (product as { product_extension?: { is_gift_card?: boolean | null } | null }).product_extension
    ?.is_gift_card === true

/** How many products each quick view holds. */
export const productCountsQuery = () =>
  queryOptions({
    queryKey: ["products", "counts"],
    queryFn: async () => {
      const count = async (status?: ProductStatus) =>
        (
          await sdk.admin.product.list({
            fields: "id",
            limit: 1,
            ...(status ? { status: [status] } : {}),
          })
        ).count
      const [all, published, draft] = await Promise.all([
        count(),
        count("published"),
        count("draft"),
      ])
      return { all, published, draft }
    },
  })

// Named one by one: a bare "*" does not bring the product's own columns
const DETAIL_FIELDS = [
  "id",
  "title",
  "subtitle",
  "handle",
  "status",
  "description",
  "thumbnail",
  "weight",
  "length",
  "width",
  "height",
  "created_at",
  "updated_at",
  "images.id",
  "images.url",
  "images.rank",
  "categories.id",
  "categories.name",
  "brand.id",
  "brand.name",
  "type.id",
  "type.value",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "variants.id",
  "variants.title",
  "variants.variant_rank",
  "variants.created_at",
  "variants.sku",
  "variants.ean",
  "variants.upc",
  "variants.barcode",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.weight",
  "variants.length",
  "variants.width",
  "variants.height",
  "variants.options.value",
  "variants.options.option_id",
  "variants.prices.id",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.inventory.location_levels.id",
  "variants.inventory_items.inventory.location_levels.location_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "variants.inventory_items.inventory.location_levels.reserved_quantity",
  "variants.inventory_items.inventory.location_levels.available_quantity",
  "images.variants.id",
  ...MEDIA_FIELDS,
].join(",")

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ["products", "detail", id],
    queryFn: async () => {
      const product = (await sdk.admin.product.retrieve(id, { fields: DETAIL_FIELDS }))
        .product as ProductDetail
      // A link whose record is gone reads as null
      return { ...product, media_assets: (product.media_assets ?? []).filter(Boolean) }
    },
    // New images get their record and versions on the server shortly after a save
    refetchInterval: (query) =>
      query.state.data && isMediaSettling(query.state.data) ? 2000 : false,
  })

export type ProductDetail = Awaited<ReturnType<typeof sdk.admin.product.retrieve>>["product"] & {
  /** The media module's records of its images (F3.3). */
  media_assets?: ProductMedia[]
}

/** Saves product fields; the page reloads what changed. */
export function useUpdateProduct(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof sdk.admin.product.update>[1]) =>
      sdk.admin.product.update(id, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

/** "Kopyala" (owner 2026-11-06): a draft copy on a free address; resolves with the copy. */
export function useDuplicateProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await sdk.client.fetch<{ product: { id: string; handle: string; title: string } }>(
          `/admin/products/${encodeURIComponent(id)}/duplicate`,
          { method: "POST" }
        )
      ).product,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

/** Where a product is seen: its live page, or a draft's signed preview for a day (F18). */
export interface StorefrontLink {
  live: boolean
  url: string
  path: string
  expires_at: string | null
}

export function useProductStorefrontLink(id: string) {
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<StorefrontLink>(`/admin/products/${encodeURIComponent(id)}/preview`, {
        method: "POST",
      }),
  })
}

export function useDeleteProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sdk.admin.product.delete(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
