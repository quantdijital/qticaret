import { useQuery } from "@tanstack/react-query"
import { sectionQuery } from "@/features/settings/api/sections"
import type { ShippingClass, ShippingSettings } from "@/features/settings/api/sections"

/** The select's value for Standard (a product without a class, adr/0087). */
export const STANDARD_CLASS = "standard"

/** The shop's own classes now (Settings > Shipping); none while they load. */
export function useShippingClasses(): ShippingClass[] {
  return useQuery(sectionQuery<ShippingSettings>("shipping")).data?.values.shipping_classes ?? []
}
