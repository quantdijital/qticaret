"use client"

import { Tag, X } from "lucide-react"
import { useActionState } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"

const INITIAL: ActionResult = { ok: false, error: null }

export interface PromotionWords {
  label: string
  placeholder: string
  apply: string
  applying: string
  remove: string
  applied: string
  /** Messages by key; anything else shows `fallback`. */
  errors: Record<string, string>
  fallback: string
}

/**
 * The coupon field and the codes already on the cart. The field is a
 * form of its own (its answer shown in place); each code's remove button
 * a plain form, so it works before the script loads.
 */
export function PromotionForm({
  codes,
  apply,
  remove,
  words,
}: {
  codes: string[]
  apply: FormAction
  remove: (form: FormData) => Promise<void>
  words: PromotionWords
}) {
  const [state, submit, pending] = useActionState(apply, INITIAL)
  return (
    <div className="flex flex-col gap-2.5">
      <form action={submit} className="flex gap-2">
        <label htmlFor="kupon" className="sr-only">
          {words.label}
        </label>
        <input
          id="kupon"
          name="code"
          required
          maxLength={64}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder={words.placeholder}
          className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground focus-visible:border-foreground/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 rounded-full border border-foreground px-5 text-sm font-semibold transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {pending ? words.applying : words.apply}
        </button>
      </form>
      <p role="status" aria-live="polite" className="text-xs empty:hidden">
        {state.error ? (
          <span className="text-sale">{words.errors[state.error] ?? words.fallback}</span>
        ) : state.ok ? (
          <span className="text-success">{words.applied}</span>
        ) : null}
      </p>
      {codes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {codes.map((code) => (
            <li key={code}>
              <form action={remove}>
                <input type="hidden" name="code" value={code} />
                <button
                  type="submit"
                  aria-label={`${words.remove}: ${code}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-success/10 pr-2 pl-3 text-xs font-semibold text-success hover:bg-success/15"
                >
                  <Tag className="size-3.5" aria-hidden="true" />
                  {code}
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
