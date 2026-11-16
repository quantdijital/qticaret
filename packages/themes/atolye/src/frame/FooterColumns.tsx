import { ArrowUp } from "lucide-react"
import { fieldMark, sectionMark } from "@qticaret/ui"
import type { FooterColumnsView, PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { CookiePreferencesLink } from "./CookiePreferencesLink"
import { BrandBlock, LinkColumns, MarkList, ReachList } from "./FooterColumnsParts"
import { NewsletterForm } from "./NewsletterForm"
import { newsletterWords } from "./newsletter-words"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

const TOOL =
  "inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-8"

/** The newsletter box: its heading and field, in the strip or at the brand block's foot. */
function Newsletter({
  shop,
  t,
  subscribe,
  wide,
}: {
  shop: ShopView
  t: Translate
  subscribe: Subscribe
  wide: boolean
}) {
  const news = shop.newsletter
  if (!news) {
    return null
  }
  return (
    <section
      aria-labelledby="bulten"
      {...sectionMark(news.mark)}
      className={cn("flex flex-col gap-4", wide && "lg:col-span-6")}
    >
      <h2
        id="bulten"
        className={cn("max-w-[28ch]", wide ? "text-title" : "text-sm font-semibold")}
        {...fieldMark(Boolean(news.mark), "title")}
      >
        {news.title}
      </h2>
      <NewsletterForm
        id="bulten-alt"
        quiet
        action={subscribe}
        privacyPath={shop.privacyPath}
        words={newsletterWords(t, news.text)}
        marks={Boolean(news.mark)}
      />
    </section>
  )
}

/**
 * The bottom line (owner 2026-11-17: the year and the cookie choices on
 * one line, the ways to pay in their place, by their own marks): the year
 * and the shop's name, the ways to pay and the carriers in the middle, the
 * cookie choices and "Yukarı çık" at the end. Below 1280 px the marks take
 * their own row first, the year and the choices share the next; the rule
 * between the ways to pay and the carriers only from 768 px, where the
 * marks keep to one row (below, it would stand alone at a row's start).
 */
function BottomLine({ shop, t }: { shop: ShopView; t: Translate }) {
  const year = new Date().getFullYear()
  const badges = shop.footerBar?.paymentBadges ?? []
  const payments = badges.length > 0 ? badges : (shop.paymentMarks ?? [])
  const carriers = shop.carrierMarks ?? []
  // The floating button does the same job: the line's link stays only where it does not show
  const floating = shop.cookieBanner?.due === true ? null : (shop.footerBar?.backToTop ?? null)
  return (
    <div className="border-t border-rule">
      <Container className="gf-foot-line py-4 lg:py-5">
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
        <div className="gf-foot-tools">
          <CookiePreferencesLink label={t("cookies.preferences")} className={TOOL} />
          {floating?.mobile !== true && (
            <a href="#top" className={cn(TOOL, "-mr-3 px-3", floating && "lg:hidden")}>
              <span className="max-sm:sr-only">{t("footer.back_to_top")}</span>
              <ArrowUp className="size-4" aria-hidden="true" strokeWidth={2} />
            </a>
          )}
        </div>
      </Container>
    </div>
  )
}

/**
 * The brand columns footer (adr/0049 Ek 2026-11-17, owner: "modern, dolu,
 * işlevsel"): on the ground the shop picks (`data-ground`: the steel
 * well, the page, the graphite stage), first an optional strip with the
 * newsletter box beside the shop's phone, WhatsApp and e-mail; then the
 * brand block (logo, the shop's own line, address, profiles, the law's
 * identity lines with the ETBİS code) beside the link columns (the footer
 * menus and the legal texts; closed rows on a phone); then one bottom line
 * with the year, the ways to pay by their own marks and the cookie
 * choices. Each part only when the shop has something for it.
 */
export function FooterColumns({
  shop,
  t,
  subscribe,
  columns,
}: {
  shop: ShopView
  t: Translate
  subscribe?: Subscribe | undefined
  columns: FooterColumnsView
}) {
  const news = subscribe && shop.newsletter ? subscribe : null
  const { contact } = shop
  const reach = [contact.phoneHref, contact.whatsappHref, contact.email].some(Boolean)
  const strip = columns.topStrip && (news !== null || reach)
  return (
    <footer
      data-gf-clear=""
      {...sectionMark(shop.footerBar?.id)}
      data-variant="brand_columns"
      data-ground={columns.ground}
      data-badges={columns.badgeStyle}
      className={cn("gf-footer-cols mt-(--footer-gap)", columns.ground === "stage" && "gf-stage")}
    >
      {strip && (
        <div className="border-b border-rule">
          <Container className="grid gap-8 py-10 lg:grid-cols-12 lg:items-center lg:gap-x-(--gap-columns) lg:py-12">
            {news && <Newsletter shop={shop} t={t} subscribe={news} wide />}
            <ReachList
              shop={shop}
              t={t}
              className={news ? "lg:col-span-5 lg:col-start-8" : "lg:col-span-12"}
            />
          </Container>
        </div>
      )}
      <Container className="grid gap-10 py-12 lg:grid-cols-12 lg:gap-x-(--gap-columns) lg:py-16">
        <BrandBlock shop={shop} t={t} about={columns.about} withContact={!strip}>
          {!strip && news && <Newsletter shop={shop} t={t} subscribe={news} wide={false} />}
        </BrandBlock>
        <LinkColumns groups={shop.footerGroups} shop={shop} t={t} />
      </Container>
      <BottomLine shop={shop} t={t} />
    </footer>
  )
}
