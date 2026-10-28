import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** What an order edit changes (adr/0033): line quantities and prices (lira), new variants. */
export interface OrderEditChange {
  items: { id: string; quantity: number; unit_price?: number }[]
  add: { variant_id: string; quantity: number }[]
}

const url = (orderId: string, path: string) =>
  `/admin/orders/${encodeURIComponent(orderId)}/${path}`

/** What the edit would cost the shopper (exact lira, positive when they owe); nothing kept. */
export const useOrderEditPreview = (orderId: string) =>
  useMutation({
    mutationFn: async (change: OrderEditChange) =>
      (
        await sdk.client.fetch<{ difference: string }>(url(orderId, "edit/preview"), {
          method: "POST",
          body: change,
        })
      ).difference,
  })

function useOrderMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: ["orders"] }),
  })
}

/**
 * The edit itself at the difference staff saw on the preview; a refund
 * the shop owes that failed comes back as its reason.
 */
export const useEditOrder = (orderId: string) =>
  useOrderMutation(
    (
      input: OrderEditChange & {
        expected_difference: number
        difference_collected: boolean
        /** This dialog's key: sent again (a retry), the edit is made once. */
        reference: string
      }
    ) =>
      sdk.client.fetch<{ difference: string | null; refund_error: string | null }>(
        url(orderId, "edit"),
        {
          method: "POST",
          body: input,
        }
      )
  )

export interface OrderAddressInput {
  first_name: string
  last_name: string
  address_1: string
  address_2: string
  province: string
  city: string
  postal_code: string
  phone: string
}

/** The delivery address, before the order is packed (Medusa's own update, checked by ours). */
export const useUpdateOrderAddress = (orderId: string) =>
  useOrderMutation((address: OrderAddressInput) =>
    sdk.admin.order.update(orderId, {
      shipping_address: { ...address, country_code: "tr" },
    })
  )

/** Variants to add, by name or code. */
export const searchVariants = async (q: string) => {
  const { variants } = await sdk.admin.productVariant.list({
    q,
    limit: 20,
    fields: "id,title,sku,product.title",
  })
  return variants.map((variant) => ({
    id: variant.id,
    label: [variant.product?.title, variant.title, variant.sku].filter(Boolean).join(" · "),
  }))
}
