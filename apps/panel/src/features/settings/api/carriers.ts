import { queryOptions, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { sdk } from "@/lib/sdk"

/**
 * The carriers this server offers (`GET /admin/shipping-setup/carriers`):
 * one suspended on the platform (adr/0027 Ek 2026-11-26 "askı": DHL
 * eCommerce until it is turned on) is left out of every screen that names
 * carriers. It changes only with the server's set-up: read once.
 */
export const offeredCarriersQuery = () =>
  queryOptions({
    queryKey: ["settings", "shipping-carriers"],
    queryFn: async () =>
      (await sdk.client.fetch<{ carriers: string[] }>("/admin/shipping-setup/carriers")).carriers,
    staleTime: Infinity,
  })

// The carrier integrations the server may suspend; any other choice (the shop's own
// delivery, pickup, "own", "other") is always shown
const CARRIERS: readonly string[] = ["aras", "yurtici", "dhlecommerce", "surat"]

/**
 * Whether a choice naming a carrier is shown: a carrier once the server
 * says it offers it (none while that loads, so a suspended one never
 * flashes), anything else always.
 */
export function useCarrierShown(): (id: string) => boolean {
  const { data } = useQuery(offeredCarriersQuery())
  return useCallback((id: string) => !CARRIERS.includes(id) || (data ?? []).includes(id), [data])
}

/** The offered carriers; undefined while they load. */
export const useOfferedCarriers = (): readonly string[] | undefined =>
  useQuery(offeredCarriersQuery()).data
