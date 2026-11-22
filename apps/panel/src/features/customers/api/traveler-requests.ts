import { useMutation } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/**
 * A traveler's own KVKK request (adr/0076 Ek D6b): a traveler is not the
 * buyer and has no account, so their rows are found by what they give.
 * Owner and admin; every search is recorded (how many found, never who).
 */

export interface TravelerSearch {
  first_name: string
  last_name: string
  birth_date?: string
  document_no?: string
}

/** A row the search found; the number only masked. */
export interface FoundTraveler {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  document_masked: string | null
  starts_at: string | null
  product_title: string | null
  /** Null: entered in a cart that never became an order. */
  order_id: string | null
  display_id: number | null
  created_at: string
  purge_after: string
}

/** A search; its answer is kept only while the page shows it (never cached). */
export function useFindTravelers() {
  return useMutation({
    mutationFn: async (search: TravelerSearch) =>
      (
        await sdk.client.fetch<{ travelers: FoundTraveler[] }>("/admin/booking-travelers/search", {
          method: "POST",
          body: search,
        })
      ).travelers,
    gcTime: 0,
  })
}

/** The rows picked deleted for good; proved again (428 asks). */
export function useEraseTravelers() {
  return useMutation({
    mutationFn: (ids: string[]) =>
      withReauth((extra) =>
        sdk.client.fetch<{ deleted: number }>("/admin/booking-travelers/erase", {
          method: "POST",
          body: { ids },
          ...extra,
        })
      ),
  })
}
