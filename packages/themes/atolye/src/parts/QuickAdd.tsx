"use client"

import { CircleAlert, LoaderCircle, Plus } from "lucide-react"
import { useActionState, useEffect, useId, useRef } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { cn } from "@qticaret/ui/lib/utils"
import { announceCartAdded } from "../frame/events"

export interface QuickAddWords {
  /** The visible word ("Sepete ekle"); a round button keeps it for the reader only. */
  add: string
  /** For a screen reader: "{title} ürününü sepete ekle". */
  label: string
  /** Said in the cart's live region when the line went in. */
  added: string
  /** The add-to-cart action's message keys in words; `cart.add_failed` for any other. */
  errors: Record<string, string>
  /** The product's page under a refusal: the way on stays open. */
  openPage: string
}

const INITIAL: ActionResult = { ok: false, error: null }

/**
 * A card's quick add: a plain form posting the one variant, quantity 1,
 * to the storefront's add-to-cart action, so it works before the script.
 * On a card a 44 px round button on the photo's corner; `wide`, the
 * filled button the close-up's width; `fill`, a framed card's button
 * across its foot. Busy while sent; once in, the cart
 * sheet opens and says so; refused, the reason in words with the
 * product's page as the way on.
 */
export function QuickAdd({
  variantId,
  path,
  action,
  words,
  wide = false,
  fill = false,
}: {
  variantId: string
  path: string
  action: FormAction
  words: QuickAddWords
  wide?: boolean
  fill?: boolean
}) {
  const shown = wide || fill
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
  const Icon = pending ? LoaderCircle : Plus
  return (
    <form
      action={submit}
      onSubmit={() => {
        sent.current = true
      }}
      className={cn("relative z-(--z-raised)", shown ? "flex flex-col gap-2" : "contents")}
    >
      <input type="hidden" name="variant_id" value={variantId} />
      <input type="hidden" name="quantity" value="1" />
      <button
        type="submit"
        className={
          fill
            ? "gf-btn gf-card-btn w-full"
            : wide
              ? "gf-btn w-full sm:w-auto"
              : "gf-icon-btn absolute right-2 bottom-2 z-(--z-raised) size-11 bg-field text-text shadow-float hover:bg-paper-2"
        }
        aria-label={words.label}
        aria-busy={pending}
        aria-disabled={pending}
        aria-describedby={error ? errorId : undefined}
        disabled={pending}
      >
        <Icon
          className={cn("size-5 shrink-0", pending && "motion-safe:animate-spin")}
          aria-hidden="true"
          strokeWidth={1.75}
        />
        {shown && words.add}
      </button>
      <span
        id={errorId}
        role="alert"
        className={shown ? "" : "absolute inset-x-2 bottom-14 z-(--z-raised)"}
      >
        {error && (
          <span className="flex items-start gap-2 rounded-inner bg-field p-2 text-sm text-error shadow-float">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
            <span>
              {error}{" "}
              <a href={path} className="font-semibold text-text underline">
                {words.openPage}
              </a>
            </span>
          </span>
        )}
      </span>
    </form>
  )
}
