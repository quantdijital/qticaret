"use client"

import { Tag, X } from "lucide-react"
import type { FormAction } from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"

export interface CodeWords {
  label: string
  /** What goes in the field, inside it: "Kampanya kodunuzu yazın". */
  placeholder: string
  apply: string
  remove: string
  applied: string
  /** Messages by key; anything else shows `fallback`. */
  errors: Record<string, string>
  fallback: string
}

/**
 * A code for the cart (a coupon, a gift card): its label over a 48 px
 * pill field and a quiet "Uygula" of the same height; the answer said
 * under it, the error in the field's own words (the code stays as typed
 * to be put right; once taken, the field empties). The codes already on the
 * cart are chips, each its own plain form that takes it off, so they work
 * before the script loads.
 */
export function CodeForm({
  id,
  codes,
  apply,
  remove,
  words,
}: {
  id: string
  codes: readonly string[]
  apply: FormAction
  remove: (form: FormData) => Promise<void>
  words: CodeWords
}) {
  const { state, pending, form } = useKeptForm(apply)
  const message = state.error ? (words.errors[state.error] ?? words.fallback) : null
  return (
    <div className="flex flex-col gap-2">
      <form {...form} className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {words.label}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            name="code"
            required
            maxLength={64}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={words.placeholder}
            aria-invalid={message ? true : undefined}
            aria-describedby={`${id}-durum`}
            className="gf-field min-w-0 flex-1 uppercase placeholder:normal-case"
          />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className="gf-btn gf-btn--quiet shrink-0 px-5"
          >
            {words.apply}
          </button>
        </div>
      </form>
      <p id={`${id}-durum`} role="status" className="text-sm font-semibold empty:hidden">
        {message ? (
          <span className="text-error">{message}</span>
        ) : state.ok ? (
          <span className="text-ok">{words.applied}</span>
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
                  className="gf-chip bg-field font-extrabold"
                >
                  <Tag className="size-4 text-ok" aria-hidden="true" strokeWidth={2} />
                  {code}
                  <X className="size-4 text-text-3" aria-hidden="true" strokeWidth={2} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
