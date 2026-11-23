import { queryOptions } from "@tanstack/react-query"
import { useFeatureState } from "@/features/settings/api/features"
import { COLLECTIONS_FLAG } from "@/features/collections/paths"
import { sdk } from "@/lib/sdk"

export { COLLECTIONS_FLAG }

/**
 * Whether the shop has collections on: true while the flags load, since
 * the flag is on by default and a field that blinks away reads worse than
 * one that stays. Off, the collection fields and choices are not offered.
 */
export function useCollectionsOn(): boolean {
  return useFeatureState(COLLECTIONS_FLAG) !== false
}

/**
 * The choices a picker offers: "collection" is left out while collections
 * are off, unless it is the one already chosen (a saved choice stays in sight).
 */
export function offeredKinds<K extends string>(
  kinds: readonly K[],
  collectionsOn: boolean,
  current?: K
): K[] {
  return collectionsOn
    ? [...kinds]
    : kinds.filter((kind) => kind !== "collection" || kind === current)
}

/**
 * How many collections have a live storefront page now: what turning
 * collections off takes offline (the switch's warning names the count).
 */
export const liveCollectionsQuery = () =>
  queryOptions({
    queryKey: ["collections", "live-count"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ live_count?: number }>("/admin/collection-board", {
          query: { limit: 1 },
        })
      ).live_count ?? 0,
  })
