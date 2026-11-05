"use client"

import { Search, X } from "lucide-react"
import { useRef, useState } from "react"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A plain GET form to `/arama`: it works before the page's script loads,
 * and the results page is the storefront's (noindex, docs/13). The
 * browser's own clear glyph is hidden (`@qticaret/ui/styles.css`); once
 * the field holds words, an X button clears them and gives the field its
 * focus back.
 */
export function SearchForm({
  id,
  label,
  placeholder,
  submit,
  clear,
  className,
  defaultValue,
}: {
  /** The field's id; the header has two forms (wide screens, phones). */
  id: string
  label: string
  placeholder: string
  submit: string
  /** "Aramayı temizle": the clear button's name. */
  clear: string
  className?: string
  defaultValue?: string
}) {
  // The clear button needs the script: never drawn in the first HTML
  const hydrated = useHydrated()
  const field = useRef<HTMLInputElement>(null)
  const [filled, setFilled] = useState(Boolean(defaultValue))
  return (
    <form action="/arama" method="get" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <button
        type="submit"
        aria-label={submit}
        className="absolute top-1/2 left-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
      <input
        ref={field}
        id={id}
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        defaultValue={defaultValue}
        onChange={(event) => {
          setFilled(event.target.value !== "")
        }}
        className="h-10 w-full rounded-button border border-border bg-card pr-10 pl-10 text-sm transition-colors outline-none placeholder:text-muted-foreground hover:border-input focus-visible:border-foreground/40"
      />
      {hydrated && filled && (
        <button
          type="button"
          aria-label={clear}
          onClick={() => {
            if (field.current) {
              field.current.value = ""
              field.current.focus()
            }
            setFilled(false)
          }}
          className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </form>
  )
}
