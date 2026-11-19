import type { ContactActions, ContentPageView, FormAction, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Blocks, type Subscribe } from "../sections/Blocks"
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
        <div className="flex min-w-0 flex-col gap-(--gap-columns) lg:sticky lg:top-(--gf-stick-top) lg:col-span-5 lg:self-start">
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

/** The contact page's parts: its form, the ways to reach the shop, its imprint. */
const isContact = (view: ContentPageView): boolean =>
  Boolean(view.contactForm ?? view.contact) || (view.identity?.length ?? 0) > 0

/** The page's text with its role's parts: the contact page's, a text of questions, any other. */
function Body({
  view,
  t,
  actions,
}: {
  view: ContentPageView
  t: Translate
  actions?: ContactActions | undefined
}) {
  return isContact(view) ? (
    <ContactBody view={view} t={t} actions={actions} />
  ) : view.faq ? (
    <FaqBody view={view} faq={view.faq} t={t} />
  ) : (
    <InfoBody view={view} t={t} />
  )
}

/**
 * Whether the page has a text to draw: a page built of sections alone
 * (adr/0073 §2) has none, its role's parts aside (the contact page's form
 * and details, the payment and shipping facts).
 */
const hasBody = (view: ContentPageView): boolean =>
  isContact(view) ||
  Boolean(view.faq ?? view.payments ?? view.shipping) ||
  view.html.replace(/<p>\s*<\/p>/g, "").trim().length > 0

/**
 * The shop's own pages and its blog posts (adr/0019, adr/0046 Ek
 * 2026-11-05 içerik sayfaları), each drawn for what it holds: a post as
 * an article with its facts, contents, products and the posts to read
 * next; the contact page with the ways to reach the shop, its imprint and
 * the form; a text of questions as grouped disclosures; any other page as
 * its text in a reading measure, with its contents or its live facts.
 * A page's own sections (adr/0073 §2) stand above its text and below it,
 * each in its own container, the page's head (its one h1) first; a page
 * with none is drawn in the one container as before.
 */
export function ContentPage({
  view,
  t,
  actions,
  subscribe,
  quickAdd,
}: {
  view: ContentPageView
  t: Translate
  actions?: ContactActions
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
}) {
  if (view.post) {
    return <PostPage view={view} t={t} />
  }
  const top = view.sections?.top ?? []
  const bottom = view.sections?.bottom ?? []
  if (top.length === 0 && bottom.length === 0) {
    return (
      <Container className="flex flex-col gap-8 pt-6 lg:gap-12 lg:pt-10">
        <PageHead view={view} t={t} />
        <Body view={view} t={t} actions={actions} />
      </Container>
    )
  }
  return (
    <>
      <Container className="pt-6 lg:pt-10">
        <PageHead view={view} t={t} />
      </Container>
      {top.length > 0 && <Blocks sections={top} t={t} subscribe={subscribe} quickAdd={quickAdd} />}
      {/* A page built of sections alone draws no empty text area */}
      {hasBody(view) && (
        <Container className="pt-8 lg:pt-12">
          <Body view={view} t={t} actions={actions} />
        </Container>
      )}
      {bottom.length > 0 && (
        <Blocks sections={bottom} t={t} subscribe={subscribe} quickAdd={quickAdd} />
      )}
    </>
  )
}
