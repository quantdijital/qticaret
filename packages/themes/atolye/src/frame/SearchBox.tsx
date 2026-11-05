import { Search } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A plain GET form to `/arama`, so it works before any script: a 48 px
 * pill with its drawn edge, its submit the magnifier inside its end. The
 * header has two (wide screens, phones), told apart by `id`.
 */
export function SearchBox({
  id,
  label,
  placeholder,
  submit,
  className,
}: {
  id: string
  label: string
  placeholder: string
  submit: string
  className?: string
}) {
  return (
    <form action="/arama" method="get" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        className="gf-field pr-14"
      />
      <button
        type="submit"
        aria-label={submit}
        className="gf-icon-btn absolute top-0.5 right-1 text-text"
      >
        <Search className="size-5" aria-hidden="true" strokeWidth={2} />
      </button>
    </form>
  )
}
