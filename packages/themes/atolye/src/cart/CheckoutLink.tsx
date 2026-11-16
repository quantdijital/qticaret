import type { CheckoutBlockedView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * "Ödemeye geç": the link to the payment, or, while the cart cannot go
 * there (`CartPageView.checkoutBlocked`), a button drawn off with the
 * reason under it. The button stays in the tab order (`aria-disabled`, not
 * `disabled`) so a keyboard reaches it and hears the reason. Without a
 * reason the link is drawn exactly as before.
 */
export function CheckoutLink({
  id,
  label,
  blocked,
  className,
  reasonClassName,
}: {
  /** The reason's id, one per drawing (the cart draws the button twice). */
  id: string
  label: string
  blocked: CheckoutBlockedView | null | undefined
  className: string
  reasonClassName?: string
}) {
  if (!blocked) {
    return (
      <a href="/odeme" className={cn("gf-btn", className)}>
        {label}
      </a>
    )
  }
  return (
    <>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={id}
        className={cn("gf-btn", className)}
      >
        {label}
      </button>
      <p id={id} className={cn("text-sm font-semibold text-error", reasonClassName)}>
        {blocked.reason}
      </p>
    </>
  )
}
