import { Search } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A plain GET form to `/arama`: it works before the page's script loads,
 * and the results page is the storefront's (noindex, docs/13).
 */
export function SearchForm({
  id,
  label,
  placeholder,
  submit,
  className,
  defaultValue,
}: {
  /** The field's id; the header has two forms (wide screens, phones). */
  id: string
  label: string
  placeholder: string
  submit: string
  className?: string
  defaultValue?: string
}) {
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
        id={id}
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-full border border-border bg-card pr-4 pl-10 text-sm transition-colors outline-none placeholder:text-muted-foreground hover:border-input focus-visible:border-foreground/40"
      />
    </form>
  )
}
