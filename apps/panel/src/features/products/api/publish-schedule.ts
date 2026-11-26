import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { PublishSchedule } from "@/features/products/publish-schedule"

const scheduleUrl = (productId: string) =>
  `/admin/products/${encodeURIComponent(productId)}/publish-schedule`

/**
 * A draft's planned publish set (an ISO moment) or cancelled (null)
 * (`/admin/products/:id/publish-schedule`, S2); the product and the list
 * reload with it.
 */
export function useSetPublishSchedule(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (publishAt: string | null) =>
      sdk.client.fetch<{ schedule: PublishSchedule }>(
        scheduleUrl(productId),
        publishAt === null
          ? { method: "DELETE" }
          : { method: "POST", body: { publish_at: publishAt } }
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
