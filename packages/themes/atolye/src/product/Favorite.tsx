"use client"

import { Heart } from "lucide-react"
import { useActionState } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { FavoriteWords } from "./words"

const ROUND =
  "gf-icon-btn ml-auto size-12 shrink-0 @min-[24rem]:ml-0 bg-paper-2 text-text hover:bg-paper-3 disabled:cursor-not-allowed"

/**
 * The favourite heart beside "add to cart": a 48 px round button that
 * saves the product for a signed-in customer (its own form, so the buy
 * form stays one), a link to sign in for a guest. Saved, the heart fills.
 */
export function Favorite({
  productId,
  signedIn,
  loginPath,
  add,
  words,
}: {
  productId: string
  signedIn: boolean
  loginPath: string
  add: FormAction
  words: FavoriteWords
}) {
  const [state, submit, pending] = useActionState(add, { ok: false, error: null } as ActionResult)
  if (!signedIn) {
    return (
      <a href={loginPath} aria-label={words.add} className={ROUND}>
        <Heart className="size-5" aria-hidden="true" strokeWidth={2} />
      </a>
    )
  }
  return (
    <form action={submit} className="relative ml-auto @min-[24rem]:ml-0">
      <input type="hidden" name="product_id" value={productId} />
      <button
        type="submit"
        aria-label={state.ok ? words.added : words.add}
        aria-pressed={state.ok}
        aria-busy={pending}
        disabled={pending || state.ok}
        className={ROUND}
      >
        <Heart
          className={cn("size-5", state.ok && "fill-deal text-deal")}
          aria-hidden="true"
          strokeWidth={2}
        />
      </button>
      <p
        role="alert"
        className="absolute top-full right-0 mt-2 w-56 text-right text-xs text-error empty:hidden"
      >
        {state.error ? (words.errors[state.error] ?? words.fallback) : null}
      </p>
    </form>
  )
}
