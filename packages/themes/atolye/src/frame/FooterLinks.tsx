import { Plus } from "lucide-react"
import type { ReactNode } from "react"
import type { FooterGroupView } from "@qticaret/ui"

type FooterGroup = FooterGroupView

const PHONE_LINK =
  "flex min-h-11 items-center text-sm text-text-2 no-underline hover:text-text hover:underline underline-offset-4"
// From 1024 px one column a group, four at most a row
const COLUMNS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"]

const WIDE_LINK =
  "inline-flex min-h-8 items-center pointer-coarse:min-h-11 text-sm text-text-2 no-underline hover:text-text hover:underline underline-offset-4"

function Links({ group, className }: { group: FooterGroup; className: string }) {
  return (
    <ul className="flex flex-col">
      {group.links.map((link) => (
        <li key={link.path}>
          <a href={link.path} className={className}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * The footer's link groups: the shop's own footer menus. On a phone each group is a closed row of 52 px that opens in
 * place (44 px links); from 1024 px the groups stand open in short
 * columns. Only one of the two is ever displayed.
 */
export function FooterLinks({ groups }: { groups: readonly FooterGroup[] }): ReactNode {
  if (groups.length === 0) {
    return null
  }
  return (
    <>
      <div className="border-t border-rule lg:hidden">
        {groups.map((group) => (
          <details key={group.title} className="group border-b border-rule">
            <summary className="flex min-h-13 cursor-pointer items-center justify-between gap-4 font-semibold">
              {group.title}
              <Plus
                className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open:rotate-45"
                aria-hidden="true"
                strokeWidth={1.75}
              />
            </summary>
            <nav aria-label={group.title} className="pb-3">
              <Links group={group} className={PHONE_LINK} />
            </nav>
          </details>
        ))}
      </div>
      <div
        className={`grid gap-x-(--gap-columns) gap-y-8 max-lg:hidden ${COLUMNS[Math.min(groups.length, 4) - 1] ?? ""}`}
      >
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-normal text-text">{group.title}</h2>
            <Links group={group} className={WIDE_LINK} />
          </nav>
        ))}
      </div>
    </>
  )
}
