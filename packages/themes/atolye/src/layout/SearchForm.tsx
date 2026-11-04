import { Search } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A plain GET form to `/arama`: it works before any script, and sent empty
 * it lands on the search page's help (the storefront's). The field and
 * its button are both 44 px; the button sits inside the field's end.
 */
export function SearchForm({
  id,
  label,
  placeholder,
  submit,
  className,
}: {
  /** The field's id; the header has two forms (wide screens, phones). */
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
        className="at-field h-11 min-h-11 w-full pr-12 text-md"
      />
      <button
        type="submit"
        aria-label={submit}
        className="at-icon-btn absolute top-0 right-0 text-text"
      >
        <Search className="size-5" aria-hidden="true" strokeWidth={1.75} />
      </button>
    </form>
  )
}
