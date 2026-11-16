import { Link } from "@tanstack/react-router"
import { cn } from "../lib/utils"

export interface SectionNavItem {
  to: string
  label: string
  /**
   * Marked current on its own address only (the default); `false` also on
   * the addresses below it: a tab whose screens have tabs of their own.
   */
  exact?: boolean
}

interface SectionNavProps {
  /** What the links are, for screen readers ("Kampanya türleri"). */
  label: string
  items: SectionNavItem[]
  /** The tabs share the page's search (a report's period), so moving between them keeps it. */
  keepSearch?: boolean
  /**
   * `sub`: the tabs inside one tab of the section (Müşteriler > Toptancılar:
   * wholesalers, levels, orders), smaller and under the section's own.
   */
  level?: "section" | "sub"
}

const SECTION_ITEM = cn(
  "relative flex h-10 shrink-0 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
  "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full",
  "data-[status=active]:font-medium data-[status=active]:text-foreground data-[status=active]:after:bg-primary"
)

const SUB_ITEM = cn(
  "flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
  "data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground"
)

/**
 * Sister screens of one sidebar section as tabs under the page title
 * (Kampanyalar: codes, price lists). Each is a link; the page it names is
 * marked current, so the address is the state. A tab with tabs of its own
 * stays marked on them (`exact: false`), and those show as a `sub` row
 * below: the way back to the section is always one click.
 */
export function SectionNav({
  label,
  items,
  keepSearch = false,
  level = "section",
}: SectionNavProps) {
  const sub = level === "sub"
  return (
    <nav
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto", sub ? "-mt-3" : "-mt-2 border-b")}
    >
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          {...(keepSearch ? { search: true } : {})}
          activeOptions={{ exact: item.exact ?? true, includeSearch: false }}
          className={sub ? SUB_ITEM : SECTION_ITEM}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
