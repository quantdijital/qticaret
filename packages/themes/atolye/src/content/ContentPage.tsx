import type { ContactActions, ContentPageView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { ContactBody } from "./ContactBody"
import { FaqBody } from "./FaqBody"
import { InstallmentTable, PaymentMarks, ShippingFacts } from "./Facts"
import { hasOutline, OutlineAside, OutlineWell } from "./Outline"
import { PageHead } from "./PageHead"
import { PostPage } from "./PostPage"
import { Prose } from "./Prose"
import { readingGrid } from "./reading"

/**
 * Any other page of the shop's (Hakkımızda, Kargo ve Teslimat, Ödeme
 * Seçenekleri, a guide): its text in a reading measure. A long text
 * stands in a post's reading column with its contents beside it (a closed
 * well on a phone); the payment and shipping pages get their live facts
 * beside the text instead (the ways to pay, the carriers, the promises)
 * and the payment page the card families' installment rates across the
 * page under it.
 */
function InfoBody({ view, t }: { view: ContentPageView; t: Translate }) {
  const payments = view.payments ?? null
  const shipping = view.shipping ?? null
  const facts = payments !== null || shipping !== null
  const outline = !facts && hasOutline(view.outline) ? (view.outline ?? []) : []
  const prose = <Prose html={view.html} tableLabel={(n) => t("content.table", { n })} />
  if (outline.length > 0) {
    const reading = readingGrid({ outline: true, tablet: false })
    return (
      <div className={`grid gap-8 ${reading.grid}`}>
        <OutlineWell outline={outline} t={t} />
        <OutlineAside id="icindekiler" outline={outline} t={t} className={reading.side} />
        <article className={`min-w-0 ${reading.column}`}>{prose}</article>
      </div>
    )
  }
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
      <article className={facts ? "min-w-0 lg:col-span-7" : "min-w-0 lg:col-span-8"}>
        {prose}
      </article>
      {facts && (
        <div className="flex min-w-0 flex-col gap-(--gap-columns) lg:sticky lg:top-40 lg:col-span-5 lg:self-start">
          {payments && payments.marks.length > 0 && <PaymentMarks marks={payments.marks} t={t} />}
          {shipping && <ShippingFacts facts={shipping} t={t} />}
        </div>
      )}
      {payments && payments.installments.length > 0 && (
        <div className="min-w-0 pt-(--space-xl) lg:col-span-12">
          <InstallmentTable facts={payments} t={t} />
        </div>
      )}
    </div>
  )
}

/**
 * The shop's own pages and its blog posts (adr/0019, adr/0046 Ek
 * 2026-11-05 içerik sayfaları), each drawn for what it holds: a post as
 * an article with its facts, contents, products and the posts to read
 * next; the contact page with the ways to reach the shop, its imprint and
 * the form; a text of questions as grouped disclosures; any other page as
 * its text in a reading measure, with its contents or its live facts.
 */
export function ContentPage({
  view,
  t,
  actions,
}: {
  view: ContentPageView
  t: Translate
  actions?: ContactActions
}) {
  if (view.post) {
    return <PostPage view={view} t={t} />
  }
  return (
    <Container className="flex flex-col gap-8 pt-6 lg:gap-12 lg:pt-10">
      <PageHead view={view} t={t} />
      {view.contactForm || view.contact || (view.identity?.length ?? 0) > 0 ? (
        <ContactBody view={view} t={t} actions={actions} />
      ) : view.faq ? (
        <FaqBody view={view} faq={view.faq} t={t} />
      ) : (
        <InfoBody view={view} t={t} />
      )}
    </Container>
  )
}
