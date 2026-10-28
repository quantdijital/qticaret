import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The abandoned cart reminders of the last 30 days (F10.7). */
export interface CartReminderSummary {
  sent: number
  /** Of those, the links a shopper followed back to the cart. */
  returned: number
  /** Of those, the carts that became an order. */
  ordered: number
}

export const cartReminderSummaryQuery = () =>
  queryOptions({
    queryKey: ["cart-reminders", "summary"],
    queryFn: () =>
      sdk.client.fetch<{ summary: CartReminderSummary }>("/admin/cart-reminders/summary"),
  })
