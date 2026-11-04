"use client"

import { Plus } from "lucide-react"
import { useActionState, useEffect, useRef } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { CART_ADDED_EVENT } from "../layout/CartDrawer"

export interface QuickAddWords {
  add: string
  /** For a screen reader: the product's name in it. */
  label: string
  added: string
  /** Said under the button when the cart refused; the card's link stays the way on. */
  failed: string
}

const INITIAL: ActionResult = { ok: false, error: null }

/**
 * A card's quick add (adr/0046 Ek 2026-11-04): a plain form posting the
 * one variant with quantity 1 to the storefront's add-to-cart action, so
 * it works before the page's script; with it, the cart drawer opens.
 * Sits above the card's own link (which covers the card).
 */
export function QuickAddButton({
  variantId,
  action,
  words,
}: {
  variantId: string
  action: FormAction
  words: QuickAddWords
}) {
  const [state, submit, pending] = useActionState(action, INITIAL)
  const sent = useRef(false)
  useEffect(() => {
    if (state.ok && sent.current) {
      sent.current = false
      window.dispatchEvent(new Event(CART_ADDED_EVENT))
      emitShopEvent({ type: "add_to_cart", variantId, quantity: 1 })
    }
  }, [state, variantId])
  return (
    <form
      action={submit}
      onSubmit={() => {
        sent.current = true
      }}
      className="relative z-10 flex flex-col gap-1.5"
    >
      <input type="hidden" name="variant_id" value={variantId} />
      <input type="hidden" name="quantity" value="1" />
      <Button
        type="submit"
        variant="outline"
        className="h-11 w-full rounded-button"
        aria-label={words.label}
        aria-busy={pending}
        disabled={pending}
      >
        <Plus aria-hidden="true" />
        {words.add}
      </Button>
      <p role="status" className="text-xs text-muted-foreground empty:hidden">
        {state.ok ? words.added : state.error ? words.failed : ""}
      </p>
    </form>
  )
}
