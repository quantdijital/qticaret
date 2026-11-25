import type { FooterGroupView, ShopView, Translate } from "@qticaret/ui"
import { CookiePreferencesLink } from "./CookiePreferencesLink"
import { FoldSummary, LINK, LinkList } from "./FooterParts"
import { legalLabel } from "./SmallPrint"

interface Column {
  title: string
  links: { path: string; label: string; title?: string }[]
  /** The legal column: the cookie choices close its list. */
  legal?: boolean
}

/**
 * The link columns: the shop's footer menus, then its legal texts as one
 * more, the cookie choices at their end in the same small row (owner
 * 2026-11-26: not beside the ways to pay; the column stands even with no
 * legal text, so the choices are on every page). On a phone each is a
 * closed 52 px row that opens in place (44 px links); from 1024 px they
 * stand open, as many across as fit at 10rem each.
 */
export function LinkColumns({
  groups,
  shop,
  t,
  className = "lg:col-span-8",
}: {
  groups: readonly FooterGroupView[]
  shop: ShopView
  t: Translate
  /** The columns' width on the brand columns' grid. */
  className?: string
}) {
  const columns: Column[] = [
    ...groups.map((group) => ({ title: group.title, links: group.links })),
    {
      title: t("footer.legal"),
      links: shop.legalLinks.map((link) => legalLabel(link, t)),
      legal: true,
    },
  ]
  const cookies = <CookiePreferencesLink label={t("cookies.preferences")} className={LINK} />
  return (
    <div className={className}>
      <div className="border-t border-rule lg:hidden">
        {columns.map((column) => (
          <details key={column.title} className="group border-b border-rule">
            <FoldSummary>{column.title}</FoldSummary>
            <nav aria-label={column.title} className="pb-3">
              <LinkList links={column.links} last={column.legal ? cookies : undefined} />
            </nav>
          </details>
        ))}
      </div>
      <div className="gf-foot-columns max-lg:hidden">
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-normal text-text">{column.title}</h2>
            <LinkList links={column.links} last={column.legal ? cookies : undefined} />
          </nav>
        ))}
      </div>
    </div>
  )
}
