import { fieldMark, sectionMark } from "@qticaret/ui"
import type { FooterColumnsView, PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { BottomLine } from "./FooterBottomLine"
import { LinkColumns } from "./FooterColumnsParts"
import { BrandBlock, ReachList } from "./FooterParts"
import { FooterNewsletterBox, footerNewsletterVariant } from "./FooterNewsletter"
import { NewsletterForm } from "./NewsletterForm"
import { newsletterWords } from "./newsletter-words"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

/** The newsletter box: its heading and field, in the strip or at the brand block's foot. */
function Newsletter({
  shop,
  t,
  subscribe,
  wide,
  column = false,
}: {
  shop: ShopView
  t: Translate
  subscribe: Subscribe
  wide: boolean
  /** The row's last column: its line under the heading, the field and button joined. */
  column?: boolean
}) {
  const news = shop.newsletter
  if (!news) {
    return null
  }
  return (
    <section
      aria-labelledby="bulten"
      {...sectionMark(news.mark)}
      className={cn("flex flex-col gap-4", wide && "lg:col-span-6", column && "gap-3")}
    >
      <h2
        id="bulten"
        className={cn("max-w-[28ch]", wide ? "text-title" : "text-sm font-semibold")}
        {...fieldMark(Boolean(news.mark), "title")}
      >
        {news.title}
      </h2>
      {column && news.description && (
        <p className="max-w-[32ch] text-sm text-text-2">{news.description}</p>
      )}
      <NewsletterForm
        id="bulten-alt"
        quiet
        joined={column}
        action={subscribe}
        privacyPath={shop.privacyPath}
        words={newsletterWords(t, news.text)}
        marks={Boolean(news.mark)}
        // The column is narrow: the field over its button when it would cut the example address
        className={column ? "gf-join-box" : ""}
      />
    </section>
  )
}

/**
 * The brand columns footer (adr/0049 Ek 2026-11-17, owner: "modern, dolu,
 * işlevsel"): on the ground the shop picks (`data-ground`: the steel
 * well, the page, the graphite stage), first an optional strip with the
 * newsletter box beside the shop's phone, WhatsApp and e-mail; then the
 * brand block (logo, the shop's own line, address, profiles, the law's
 * identity lines with the ETBİS code) beside the link columns (the footer
 * menus and the legal texts with the cookie choices; closed rows on a
 * phone); then one bottom line with the year and the ways to pay by their
 * own marks. Each part only when the shop has something for it.
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
  // The newsletter box's variant (adr/0049 Ek 2026-11-17): today's box in the strip or the
  // brand block, a band of its own at the top, or small in the brand column
  const drawn = subscribe ? footerNewsletterVariant(shop) : null
  const news = subscribe && drawn === "standard" ? subscribe : null
  const band = drawn === "split" || drawn === "image_card" || drawn === "strip" ? drawn : null
  const { contact } = shop
  const reach = [contact.phoneHref, contact.whatsappHref, contact.email].some(Boolean)
  const strip = columns.topStrip && (news !== null || reach)
  // The newsletter as the row's last column, while it is not in the strip above
  const asColumn = columns.newsPlace === "column" && !strip ? news : null
  return (
    <footer
      data-gf-clear=""
      {...sectionMark(shop.footerBar?.id)}
      data-variant="brand_columns"
      data-ground={columns.ground}
      data-badges={columns.badgeStyle}
      className={cn("gf-footer-cols mt-(--footer-gap)", columns.ground === "stage" && "gf-stage")}
    >
      {subscribe && band && (
        <div className="border-b border-rule">
          <Container className="py-8 lg:py-10">
            <FooterNewsletterBox shop={shop} t={t} subscribe={subscribe} variant={band} />
          </Container>
        </div>
      )}
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
      <Container
        className={cn(
          "grid gap-10 py-12 lg:grid-cols-12 lg:gap-x-(--gap-columns) lg:py-16",
          // One row of five: brand, the link columns, the newsletter (`news_place: column`)
          asColumn && "lg:py-12"
        )}
      >
        <BrandBlock
          shop={shop}
          t={t}
          about={columns.about}
          withContact={!strip}
          bare={columns.brandContact === "hide"}
          className={asColumn ? "lg:col-span-3" : undefined}
        >
          {!strip && news && !asColumn && (
            <Newsletter shop={shop} t={t} subscribe={news} wide={false} />
          )}
          {subscribe && drawn === "in_footer" && (
            <FooterNewsletterBox shop={shop} t={t} subscribe={subscribe} variant="in_footer" />
          )}
        </BrandBlock>
        {asColumn ? (
          <>
            <LinkColumns groups={shop.footerGroups} shop={shop} t={t} className="lg:col-span-6" />
            <div className="lg:col-span-3 lg:border-l lg:border-rule lg:pl-(--gap-columns)">
              <Newsletter shop={shop} t={t} subscribe={asColumn} wide={false} column />
            </div>
          </>
        ) : (
          <LinkColumns groups={shop.footerGroups} shop={shop} t={t} />
        )}
      </Container>
      <BottomLine shop={shop} t={t} center={columns.bottomAlign === "center"} />
    </footer>
  )
}
