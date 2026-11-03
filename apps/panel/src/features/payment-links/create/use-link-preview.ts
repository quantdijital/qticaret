import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"
import type { Control } from "react-hook-form"
import { linkPreviewQuery } from "@/features/payment-links/api/payment-links"
import type { PreviewInput } from "@/features/payment-links/api/types"
import type { LinkFormValues } from "@/features/payment-links/form"
import { previewOf } from "@/features/payment-links/request"

/** How long the form must rest before it is priced: a few keystrokes make one request. */
export const PREVIEW_DELAY_MS = 400

/**
 * The backend's pricing of the form on screen (adr/0051 §2), asked once the
 * choice rests: the lines at the catalog's prices for this customer, the
 * discount within the role's limit, the total, the lines short on stock.
 */
export function useLinkPreview(control: Control<LinkFormValues>, canDiscount: boolean) {
  const [
    customerMode,
    customer,
    lines,
    deliver,
    shippingOption,
    discountOn,
    discountType,
    discountValue,
    discountReason,
  ] = useWatch({
    control,
    name: [
      "customerMode",
      "customer",
      "lines",
      "deliver",
      "shipping_option_id",
      "discountOn",
      "discountType",
      "discountValue",
      "discountReason",
    ],
  })
  const input = previewOf(
    {
      customerMode,
      customer,
      lines,
      deliver,
      shipping_option_id: shippingOption,
      discountOn,
      discountType,
      discountValue,
      discountReason,
    },
    canDiscount
  )
  const key = JSON.stringify(input)
  const [asked, setAsked] = useState(key)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAsked(key)
    }, PREVIEW_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [key])
  const query = useQuery(linkPreviewQuery(JSON.parse(asked) as PreviewInput | null))
  return {
    query,
    /** No line yet: nothing to price. */
    empty: input === null,
    /** What is shown is not yet the form on screen. */
    stale: asked !== key || query.isPlaceholderData || query.isFetching,
    /** A discount is switched on but not whole yet, so the summary leaves it out. */
    discountPending: canDiscount && discountOn && input !== null && !input.discount,
  }
}

export type LinkPreviewState = ReturnType<typeof useLinkPreview>
