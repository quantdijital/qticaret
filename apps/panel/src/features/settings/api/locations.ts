import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Warehouses (F3.7): Medusa's stock locations and the store's default one. */

export interface LocationAddress {
  address_1: string
  /** Mahalle (F1.4). */
  address_2: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  phone: string | null
  country_code: string
}

export interface Location {
  id: string
  name: string
  address: LocationAddress | null
}

export interface Locations {
  locations: Location[]
  defaultId: string | null
}

export const locationsQuery = () =>
  queryOptions({
    queryKey: ["settings", "locations"],
    queryFn: async (): Promise<Locations> => {
      const [{ stock_locations: locations }, { stores }] = await Promise.all([
        sdk.admin.stockLocation.list({
          fields:
            "id,name,address.address_1,address.address_2,address.city,address.province,address.postal_code,address.phone,address.country_code",
          limit: 100,
        }),
        sdk.admin.store.list({ fields: "id,default_location_id" }),
      ])
      const store = stores[0]
      return {
        locations: [...locations]
          .map((location) => ({
            id: location.id,
            name: location.name,
            address: location.address
              ? {
                  address_1: location.address.address_1,
                  address_2: location.address.address_2 ?? null,
                  city: location.address.city ?? null,
                  province: location.address.province ?? null,
                  postal_code: location.address.postal_code ?? null,
                  phone: location.address.phone ?? null,
                  country_code: location.address.country_code,
                }
              : null,
          }))
          // The default first, then by name
          .sort(
            (a, b) =>
              Number(b.id === store?.default_location_id) -
                Number(a.id === store?.default_location_id) || a.name.localeCompare(b.name, "tr")
          ),
        defaultId: store?.default_location_id ?? null,
      }
    },
  })

function useLocationInvalidation() {
  const client = useQueryClient()
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["settings", "locations"] }),
      // The product wizard and the stock page write to the default warehouse
      client.invalidateQueries({ queryKey: ["lookups", "shop-defaults"] }),
      client.invalidateQueries({ queryKey: ["inventory"] }),
    ])
  }
}

export interface LocationInput {
  name: string
  /** None keeps the stored address (a foreign one the panel does not edit). */
  address?: LocationAddress | undefined
}

/**
 * Adds or changes a warehouse through the panel's routes: one workflow
 * each, a new one selling to the shop's channel at once (F3.7).
 */
export function useSaveLocation() {
  const invalidate = useLocationInvalidation()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string | undefined; input: LocationInput }) =>
      sdk.client.fetch<{ warehouse: { id: string } }>(
        id ? `/admin/warehouses/${encodeURIComponent(id)}` : "/admin/warehouses",
        { method: "POST", body: input }
      ),
    onSettled: invalidate,
  })
}

export function useDeleteLocation() {
  const invalidate = useLocationInvalidation()
  return useMutation({
    mutationFn: (id: string) => sdk.admin.stockLocation.delete(id),
    onSettled: invalidate,
  })
}

/** The store's default warehouse; it sells to the shop's channel from then on. */
export function useSetDefaultLocation() {
  const invalidate = useLocationInvalidation()
  return useMutation({
    mutationFn: (locationId: string) =>
      sdk.client.fetch(`/admin/warehouses/${encodeURIComponent(locationId)}/default`, {
        method: "POST",
      }),
    onSettled: invalidate,
  })
}
