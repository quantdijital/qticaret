import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

interface SectionNavProps {
  /** What the links are, for screen readers ("Kampanya türleri"). */
  label: string
  items: { to: string; label: string }[]
}

/**
 * Sister screens of one sidebar section as tabs under the page title
 * (Kampanyalar: codes, price lists). Each is a link; the page it names is
 * marked current, so the address is the state.
 */
export function SectionNav({ label, items }: SectionNavProps) {
  return (
    <nav aria-label={label} className="-mt-2 flex gap-1 overflow-x-auto border-b">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: true }}
          className={cn(
            "relative flex h-10 shrink-0 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
            "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full",
            "data-[status=active]:font-medium data-[status=active]:text-foreground data-[status=active]:after:bg-primary"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
