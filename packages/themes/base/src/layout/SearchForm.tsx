import { Search } from "lucide-react"
import { Input } from "@qticaret/ui/components/input"
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
      <Input
        id={id}
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        className="h-10 rounded-full bg-muted pr-11 pl-4 border-transparent focus-visible:bg-background"
      />
      <button
        type="submit"
        aria-label={submit}
        className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
    </form>
  )
}
