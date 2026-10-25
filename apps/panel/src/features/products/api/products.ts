import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

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
].join(",")

export interface ProductListParams {
  q: string
  status: ProductStatus | "all"
  page: number
}

export const productsQuery = ({ q, status, page }: ProductListParams) =>
  queryOptions({
    queryKey: ["products", "list", { q, status, page }],
    queryFn: () =>
      sdk.admin.product.list({
        fields: LIST_FIELDS,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        order: "-updated_at",
        ...(q ? { q } : {}),
        ...(status === "all" ? {} : { status: [status] }),
      }),
    placeholderData: keepPreviousData,
  })

export type ProductListItem = Awaited<ReturnType<typeof sdk.admin.product.list>>["products"][number]

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
].join(",")

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ["products", "detail", id],
    queryFn: async () => (await sdk.admin.product.retrieve(id, { fields: DETAIL_FIELDS })).product,
  })

export type ProductDetail = Awaited<ReturnType<typeof sdk.admin.product.retrieve>>["product"]

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
