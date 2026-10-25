import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Brands (F3.11, `/admin/brands`). */

export const BRAND_PAGE_SIZE = 25

export interface Brand {
  id: string
  name: string
  handle: string
  description: string | null
  logo_file_id: string | null
  logo_url: string | null
  is_active: boolean
  product_count: number
  created_at: string
}

export interface BrandInput {
  name?: string
  handle?: string
  description?: string | null
  logo_file_id?: string | null
  is_active?: boolean
}

export const brandsQuery = ({ q, page }: { q: string; page: number }) =>
  queryOptions({
    queryKey: ["brands", "list", { q, page }],
    queryFn: () =>
      sdk.client.fetch<{ brands: Brand[]; count: number }>("/admin/brands", {
        query: { offset: page * BRAND_PAGE_SIZE, limit: BRAND_PAGE_SIZE, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

export const brandQuery = (id: string) =>
  queryOptions({
    queryKey: ["brands", "detail", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ brand: Brand }>(`/admin/brands/${encodeURIComponent(id)}`)).brand,
  })

/** Brands whose name holds `q`, for a picker. */
export const brandOptions = async (q: string) =>
  (
    await sdk.client.fetch<{ brands: Brand[] }>("/admin/brands", {
      query: { limit: 20, ...(q ? { q } : {}) },
    })
  ).brands.map((brand) => ({ id: brand.id, label: brand.name, inactive: !brand.is_active }))

function useBrandsChanged() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ["brands"] })
}

export function useCreateBrand() {
  const changed = useBrandsChanged()
  return useMutation({
    mutationFn: (body: BrandInput & { name: string }) =>
      sdk.client.fetch<{ brand: Brand }>("/admin/brands", { method: "POST", body }),
    onSettled: changed,
  })
}

export function useUpdateBrand(id: string) {
  const changed = useBrandsChanged()
  return useMutation({
    mutationFn: (body: BrandInput) =>
      sdk.client.fetch<{ brand: Brand }>(`/admin/brands/${encodeURIComponent(id)}`, {
        method: "POST",
        body,
      }),
    onSettled: changed,
  })
}

export function useDeleteBrand() {
  const changed = useBrandsChanged()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/brands/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: changed,
  })
}

/** Sets a product's brand, or takes it off with null. */
export function useSetProductBrand(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (brandId: string | null) =>
      sdk.client.fetch(`/admin/products/${encodeURIComponent(productId)}/brand`, {
        method: "POST",
        body: { brand_id: brandId },
      }),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["brands"] }),
      ])
    },
  })
}
