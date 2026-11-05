"use client"

import { CircleAlert, LoaderCircle, Plus } from "lucide-react"
import { useActionState, useEffect, useId, useRef } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { announceCartAdded } from "../layout/events"

export interface QuickAddWords {
  add: string
  /** For a screen reader: "{title} ürününü sepete ekle", the visible words in it. */
  label: string
  /** Said in the cart's live region when the line went in. */
  added: string
  /** The add-to-cart action's message keys in words; `cart.add_failed` for any other. */
  errors: Record<string, string>
  /** The link to the product's page under a refusal: the way on is still open. */
  openPage: string
}

const INITIAL: ActionResult = { ok: false, error: null }

/**
 * A card's quick add (design.md § Product card; adr/0046 Ek 2026-11-04): a
 * plain form posting the one variant, quantity 1, to the storefront's
 * add-to-cart action, so it works before the page's script. The secondary
 * button the card's width, 44 px: while it is sent it stays in place,
 * busy and closed to a second press; once in, the cart drawer opens and
 * its live region says so (no toast); refused, the reason under the
 * button in words and the error colour, with the product's page as the
 * way on. It sits above the card's own link, which covers the card. The
 * home page's close-up (`home/CloseUp`) sends the same form from the
 * page's filled button, its one action there.
 */
export function QuickAdd({
  variantId,
  path,
  action,
  words,
  primary = false,
}: {
  variantId: string
  path: string
  action: FormAction
  words: QuickAddWords
  /** The filled button at its full 48 px (the close-up), not a card's quiet 44 px one. */
  primary?: boolean
}) {
  const [state, submit, pending] = useActionState(action, INITIAL)
  const sent = useRef(false)
  const errorId = useId()
  useEffect(() => {
    if (state.ok && sent.current) {
      sent.current = false
      announceCartAdded(words.added)
      emitShopEvent({ type: "add_to_cart", variantId, quantity: 1 })
    }
  }, [state, variantId, words.added])
  const error =
    !pending && !state.ok && state.error
      ? (words.errors[state.error] ?? words.errors["cart.add_failed"] ?? null)
      : null
  return (
    <form
      action={submit}
      onSubmit={() => {
        sent.current = true
      }}
      className="relative z-(--z-raised) flex flex-col"
    >
      <input type="hidden" name="variant_id" value={variantId} />
      <input type="hidden" name="quantity" value="1" />
      <button
        type="submit"
        className={primary ? "at-btn w-full" : "at-btn at-btn--quiet min-h-11 w-full px-4"}
        aria-label={words.label}
        aria-busy={pending}
        aria-disabled={pending}
        aria-describedby={error ? errorId : undefined}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle
            className="size-5 shrink-0 motion-safe:animate-spin"
            aria-hidden="true"
            strokeWidth={1.5}
          />
        ) : (
          <Plus className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
        )}
        {words.add}
      </button>
      <div id={errorId} role="alert">
        {error && (
          <p className="flex items-start gap-2 pt-2 text-sm text-error">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={1.5} />
            <span>
              {error}{" "}
              <a href={path} className="at-inline-link text-text">
                {words.openPage}
              </a>
            </span>
          </p>
        )}
      </div>
    </form>
  )
}
