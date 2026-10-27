import { useMutation } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * A parcel's label (F7, adr/0031): the server answers a short-lived link to
 * the PDF in private storage; reading it is logged.
 */
export const useLabelLink = (orderId: string) =>
  useMutation({
    mutationFn: async (fulfillmentId: string) =>
      (
        await sdk.client.fetch<{ url: string }>(
          `/admin/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(fulfillmentId)}/label`
        )
      ).url,
  })
