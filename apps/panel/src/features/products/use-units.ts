import { useQuery } from "@tanstack/react-query"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StoreSettings } from "@/features/settings/api/sections"

/** The units the shop keeps weight and size in (store settings; g and cm by default). */
export function useStoreUnits(): {
  weight: StoreSettings["weight_unit"]
  dimension: StoreSettings["dimension_unit"]
} {
  const { data } = useQuery(sectionQuery<StoreSettings>("store"))
  return { weight: data?.values.weight_unit ?? "g", dimension: data?.values.dimension_unit ?? "cm" }
}
