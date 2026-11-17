import { fieldMark, sectionMark } from "@qticaret/ui"
import type {
  FooterRowView,
  FooterRowsView,
  PlaceOrderResult,
  ShopView,
  Translate,
} from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { BottomLine } from "./FooterBottomLine"
import { FooterIdentity } from "./FooterIdentity"
import { FooterBlock } from "./footer-blocks/FooterBlock"
import { foldJoins } from "./footer-blocks/fold-joins"
import { legalLabel } from "./SmallPrint"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

const LEGAL_LINK =
  "inline-flex min-h-11 items-center text-xs text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-8"

/** Each column's share of its row: `2-1-1` gives 0.5, 0.25, 0.25. */
const sharesOf = (layout: FooterRowView["layout"]) => {
  const parts = layout.split("-").map(Number)
  const whole = parts.reduce((sum, part) => sum + part, 0)
  return parts.map((part) => part / whole)
}

/**
 * One row (adr/0070 §2): its ground (`inherit` the footer's, or the
 * look's), the room above and below it, its columns on the split's grid
 * from 1024 px (`data-layout`), two side by side from 768 px, one (or the
 * shop's two) on a phone. Reading order is the DOM's: row, column, block.
 */
function Row({
  row,
  index,
  shop,
  t,
  editor,
  dark,
  subscribe,
}: {
  row: FooterRowView
  index: number
  shop: ShopView
  t: Translate
  editor: boolean
  subscribe?: Subscribe | undefined
  /** The footer stands on the stage: a row on its ground is dark too. */
  dark: boolean
}) {
  const shares = sharesOf(row.layout)
  const joins = foldJoins(row, shop, Boolean(subscribe))
  return (
    <div
      className={cn(
        "gf-frow",
        (row.ground === "stage" || (row.ground === "inherit" && dark)) && "gf-stage"
      )}
      data-ground={row.ground}
      data-space={row.space}
      data-align={row.align}
      {...(row.divider ? { "data-divider": "" } : {})}
      {...fieldMark(editor, `rows.${String(index)}`)}
    >
      <Container
        className="gf-frow-grid"
        data-layout={row.layout}
        data-phone-columns={String(row.phoneColumns)}
      >
        {row.columns.map((column, at) => (
          // A column has no id: its place in the row is what it is
          <div key={at} className="gf-fcol">
            {column.blocks.map((block) => (
              <FooterBlock
                key={block.id}
                block={block}
                shop={shop}
                t={t}
                editor={editor}
                subscribe={subscribe}
                share={shares[at] ?? 1}
                join={joins.get(block.id)}
              />
            ))}
          </div>
        ))}
      </Container>
    </div>
  )
}

/**
 * The legal strip (adr/0070 §3), under the rows whatever the shop laid
 * out: the legal texts (the KVKK notice by its short name), the identity
 * lines the law asks for beside the ETBİS code. Not a block: always drawn.
 */
function LegalStrip({ shop, t }: { shop: ShopView; t: Translate }) {
  const label = t("footer.legal")
  return (
    <div data-footer-legal="" className="border-t border-rule">
      <Container className="flex flex-col gap-4 py-6 lg:flex-row lg:items-start lg:justify-between lg:gap-(--gap-columns)">
        {shop.legalLinks.length > 0 && (
          <nav aria-label={label} className="min-w-0 lg:max-w-[60%]">
            <ul className="flex flex-wrap gap-x-5">
              {shop.legalLinks.map((each) => {
                const link = legalLabel(each, t)
                return (
                  <li key={link.path}>
                    <a href={link.path} title={link.title} className={LEGAL_LINK}>
                      {link.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
        <FooterIdentity shop={shop} t={t} />
      </Container>
    </div>
  )
}

/**
 * The free rows footer (adr/0070, "Serbest düzen"): on the ground the shop
 * picks (`data-ground`, the brand columns' names and tokens), its rows of
 * blocks, then the two fixed parts no layout takes away: the legal strip
 * and the bottom line (the year, the ways to pay when `bottomBadges`, the
 * cookie choices, "Yukarı çık").
 */
export function FooterRows({
  shop,
  t,
  subscribe,
  free,
  rows,
}: {
  shop: ShopView
  t: Translate
  subscribe?: Subscribe | undefined
  free: FooterRowsView
  rows: readonly FooterRowView[]
}) {
  const editor = shop.editor === true
  const dark = free.ground === "stage"
  return (
    <footer
      data-gf-clear=""
      {...sectionMark(shop.footerBar?.id)}
      data-variant="free_rows"
      data-ground={free.ground}
      data-badges={free.badgeStyle}
      className={cn("gf-footer-rows mt-(--footer-gap)")}
    >
      {rows.map((row, index) => (
        <Row
          key={row.id}
          row={row}
          index={index}
          shop={shop}
          t={t}
          editor={editor}
          dark={dark}
          subscribe={subscribe}
        />
      ))}
      <div className={cn("gf-foot-fixed", dark && "gf-stage")}>
        <LegalStrip shop={shop} t={t} />
        <BottomLine shop={shop} t={t} marks={free.bottomBadges} />
      </div>
    </footer>
  )
}
