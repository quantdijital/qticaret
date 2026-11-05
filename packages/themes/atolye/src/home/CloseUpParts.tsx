import type { ReactNode } from "react"
import type { PriceView, SpecGroupView, SpecView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { DiscountBadge } from "../components/ProductCard"

/** A no-break space: a separator stays at the end of its line, never opens the next. */
const glue = (text: string) => text.replace(/ ([|–—-]) /g, " $1 ")

/**
 * A catalogue name set as a display head: the name before the shop's
 * " | " (the product's own name), the words after it as the line under
 * it; a dash or a bar never opens a line. Nothing is rewritten.
 */
export function nameParts(title: string): { name: string; rest: string | null } {
  const at = title.indexOf(" | ")
  return at > 0
    ? { name: glue(title.slice(0, at).trim()), rest: glue(title.slice(at + 3).trim()) || null }
    : { name: glue(title.trim()), rest: null }
}

/**
 * The price as the close-up's figure (design.md § Type, price-hero):
 * Caslon at 32 to 40 px in the ink, the struck-through price before it in
 * the quiet ink and its share off on the discount badge (the red stays on
 * the badge, beside the shop's own colour on the button); a cart offer,
 * when the view carries one, said beneath it, never in it; then the stock
 * in words (`children`), never as a number.
 */
export function Figure({
  price,
  t,
  children,
}: {
  price: PriceView
  t: Translate
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="tabular flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {price.before && (
          <s className="text-md text-text-3">
            <span className="sr-only">{t("price.before")} </span>
            {price.before}
          </s>
        )}
        <span className="font-display text-price-hero leading-[1.1]">
          {price.from ? t("price.from", { price: price.current }) : price.current}
        </span>
        {price.discount !== null && (
          <span className="self-center bg-discount px-2 py-1 text-xs font-medium text-discount-ink">
            <DiscountBadge percent={price.discount} t={t} />
          </span>
        )}
      </p>
      {price.cartOffer && <p className="text-sm font-medium text-text-2">{price.cartOffer}</p>}
      {children}
    </div>
  )
}

/**
 * The shop's headline facts as a short ruled sheet: the name small, the
 * value at the title size; two across on a phone (an odd count's first
 * the whole width), three side by side from 640 px when there are three.
 */
export function Facts({ facts }: { facts: readonly SpecView[] }) {
  const odd = facts.length % 2 === 1
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-4",
        facts.length === 3 && "sm:grid-cols-3"
      )}
    >
      {facts.map((fact) => (
        <div
          key={fact.label}
          className={cn(
            "flex min-w-0 flex-col gap-1",
            odd && "first:col-span-2",
            facts.length === 3 && "sm:first:col-span-1"
          )}
        >
          <dt className="text-sm text-text-3">{fact.label}</dt>
          <dd className="tabular text-lg leading-[1.3] font-medium">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Below the photograph, side by side: three from 1024 px, four from 1280 (five or more: three). */
const SHEET_COLUMNS: Record<number, string> = {
  1: "md:grid-cols-2",
  2: "md:grid-cols-2",
  3: "lg:grid-cols-3",
}

/**
 * The spec table in its template's sections (design.md § Spec table):
 * each section's name small in the quiet ink under an ink rule, its rows
 * under hairlines, the name of a row on the left and its value on the
 * right with the unit beside it. `stacked`: one ruled list in the words'
 * column; otherwise the sections side by side under the photograph.
 */
export function Sheet({
  groups,
  level,
  stacked,
  t,
}: {
  groups: readonly SpecGroupView[]
  level: "h3" | "h4"
  stacked: boolean
  t: Translate
}) {
  const Head = level
  const columns = stacked
    ? ""
    : (SHEET_COLUMNS[groups.length] ??
      (groups.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"))
  return (
    <div className={cn("grid gap-x-(--gap-columns)", stacked ? "gap-y-6" : "gap-y-10", columns)}>
      {groups.map((group, index) => (
        <div
          key={group.title ?? `-${String(index)}`}
          className="min-w-0 border-t-2 border-rule-ink"
        >
          <Head className="py-3 text-sm leading-[1.4] font-medium text-text-3">
            {group.title ?? t("product.specs")}
          </Head>
          <dl>
            {group.rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-t border-rule py-3"
              >
                <dt className="text-md text-text-2">{row.label}</dt>
                <dd className="tabular text-md font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
