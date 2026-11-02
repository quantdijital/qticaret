"use client"

import { Heart } from "lucide-react"
import { useActionState } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"

/** Saves the product to a signed-in customer's favorites (F10); a guest is sent to sign in. */
export function FavoriteButton({
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
  words: { add: string; added: string; errors: Record<string, string>; fallback: string }
}) {
  const [state, submit, pending] = useActionState(add, { ok: false, error: null } as ActionResult)
  const button =
    "flex h-11 w-full items-center justify-center gap-2 rounded-button border text-sm font-semibold hover:bg-foreground/5"
  if (!signedIn) {
    return (
      <a href={loginPath} className={button}>
        <Heart className="size-4" aria-hidden="true" />
        {words.add}
      </a>
    )
  }
  return (
    <form action={submit} className="flex flex-col gap-1">
      <input type="hidden" name="product_id" value={productId} />
      <button type="submit" disabled={pending || state.ok} className={button}>
        <Heart className={state.ok ? "size-4 fill-sale text-sale" : "size-4"} aria-hidden="true" />
        {state.ok ? words.added : words.add}
      </button>
      {state.error && (
        <p role="alert" className="text-center text-xs text-sale">
          {words.errors[state.error] ?? words.fallback}
        </p>
      )}
    </form>
  )
}
