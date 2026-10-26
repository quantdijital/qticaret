import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Turkish address reference data (F1.4) for the panel's address forms. */

export interface TrProvince {
  id: string
  /** Plate code, two digits ("06"). */
  code: string
  name: string
}

export interface TrDistrict {
  id: string
  name: string
}

// It changes about once a year (adr/0008): read once per session
export const provincesQuery = () =>
  queryOptions({
    queryKey: ["tr-address", "provinces"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ provinces: TrProvince[] }>("/admin/tr-address/provinces", {
          query: { limit: 100 },
        })
      ).provinces,
    staleTime: Infinity,
  })

export const districtsQuery = (provinceCode: string | null) =>
  queryOptions({
    queryKey: ["tr-address", "districts", provinceCode],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ districts: TrDistrict[] }>("/admin/tr-address/districts", {
          query: { province: provinceCode ?? "", limit: 100 },
        })
      ).districts,
    enabled: provinceCode !== null,
    staleTime: Infinity,
  })
