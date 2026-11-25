import { ArrowUp } from "lucide-react"
import type { ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { MarkList } from "./FooterParts"

const TOOL =
  "inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-text-2 no-underline hover:text-text lg:pointer-fine:min-h-8"

/**
 * The bottom line (owner 2026-11-17: the year and the cookie choices on
 * one line, the ways to pay in their place, by their own marks): the year
 * and the shop's name, the ways to pay and the carriers in the middle,
 * "Yukarı çık" at the end (the cookie choices beside the legal texts, owner
 * 2026-11-26: not beside the ways to pay). Below 1280 px the marks take
 * their own row first, the year and the choices share the next; the rule
 * between the ways to pay and the carriers only from 768 px, where the
 * marks keep to one row (below, it would stand alone at a row's start).
 * `marks` off (the free rows footer's `bottom_badges`, adr/0070): no marks.
 */
export function BottomLine({
  shop,
  t,
  marks = true,
  center = false,
}: {
  shop: ShopView
  t: Translate
  marks?: boolean
  /** The words in the middle between two rules, no rule above (`bottom_align: center`). */
  center?: boolean
}) {
  const year = new Date().getFullYear()
  const badges = shop.footerBar?.paymentBadges ?? []
  const payments = !marks ? [] : badges.length > 0 ? badges : (shop.paymentMarks ?? [])
  const carriers = marks ? (shop.carrierMarks ?? []) : []
  // The floating button does the same job: the line's link stays only where it does not show
  const floating = shop.cookieBanner?.due === true ? null : (shop.footerBar?.backToTop ?? null)
  return (
    <div className={center ? undefined : "border-t border-rule"}>
      <Container className="gf-foot-line py-4 lg:py-5" data-align={center ? "center" : undefined}>
        <p className="gf-foot-copy text-xs text-text-3">
          {t("footer.copyright", { year, name: shop.companyTitle ?? shop.name })}
        </p>
        {(payments.length > 0 || carriers.length > 0) && (
          <div className="gf-foot-marks">
            <MarkList marks={payments} label={t("footer.payment_marks")} />
            {payments.length > 0 && carriers.length > 0 && (
              <span aria-hidden="true" className="h-6 w-px shrink-0 bg-rule max-md:hidden" />
            )}
            <MarkList marks={carriers} label={t("footer.carrier_marks")} />
          </div>
        )}
        {floating?.mobile !== true && (
          <div className="gf-foot-tools">
            <a href="#top" className={cn(TOOL, "-mr-3 px-3", floating && "lg:hidden")}>
              <span className="max-sm:sr-only">{t("footer.back_to_top")}</span>
              <ArrowUp className="size-4" aria-hidden="true" strokeWidth={2} />
            </a>
          </div>
        )}
      </Container>
    </div>
  )
}
