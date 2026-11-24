import type { ReactNode } from "react"
import { fieldMark } from "@qticaret/ui"
import type {
  ContactActions,
  ContentPageSectionView,
  HomeSectionView,
  PageArticleView,
  PageFaqView,
  PagePaymentFactsView,
  PageShippingFactsView,
  PageTextSectionView,
  Translate,
} from "@qticaret/ui"
import { Look } from "../sections/Look"
import { headingId } from "../sections/plan"
import { ContactBody } from "./ContactBody"
import { FaqBody } from "./FaqBody"
import { InstallmentTable, PaymentMarks, ShippingFacts } from "./Facts"
import { hasOutline, OutlineAside, OutlineWell } from "./Outline"
import { Prose } from "./Prose"
import { readingGrid } from "./reading"

/**
 * A content page's own text sections (adr/0073 Ek 2026-11-19 (2) K2, K8),
 * drawn as the page drew its text before they were sections: the text in
 * a reading measure (its contents beside a long one, a text of questions
 * as grouped disclosures), the contact page's body, the payment and
 * shipping facts beside the text they follow and across the page alone.
 * Each stands in its look's box with its mark (`Look`, adr/0065 §4); a
 * section drawn beside another carries its own mark there.
 */

/** Whether a page's section is one of the page's own text sections. */
export const isPageText = (section: ContentPageSectionView): section is PageTextSectionView =>
  section.type === "contact" ||
  section.type === "payment_facts" ||
  section.type === "shipping_facts" ||
  (section.type === "rich_text" && section.variant === "article") ||
  // The questions page (adr/0073 Ek 2026-11-24 (2)): the home page's FAQ view carries no variant
  (section.type === "faq" && "variant" in section)

/** Whether a page's section is one of the home page's types (drawn by `Blocks`). */
export const isHomeSection = (section: ContentPageSectionView): section is HomeSectionView =>
  !isPageText(section)

/** The facts beside a text: each at most once (K2). */
interface Beside {
  payments: PagePaymentFactsView | null
  shipping: PageShippingFactsView | null
}

/** One drawn part of a run of text sections: a text with the facts right after it, or one alone. */
export type TextPart =
  | { kind: "article"; article: PageArticleView; beside: Beside }
  | { kind: "one"; section: Exclude<PageTextSectionView, PageArticleView> }

/**
 * A run of text sections as drawn parts: the payment and shipping facts
 * right after a text stand beside it (the payment and shipping pages'
 * drawing), unless the text is read as questions; any other alone.
 */
export function textParts(sections: readonly PageTextSectionView[]): TextPart[] {
  const parts: TextPart[] = []
  for (const section of sections) {
    const last = parts.at(-1)
    if (section.type === "rich_text") {
      parts.push({ kind: "article", article: section, beside: { payments: null, shipping: null } })
      continue
    }
    if (last?.kind === "article" && last.article.faq === null) {
      if (section.type === "payment_facts" && !last.beside.payments) {
        last.beside.payments = section
        continue
      }
      if (section.type === "shipping_facts" && !last.beside.shipping) {
        last.beside.shipping = section
        continue
      }
    }
    parts.push({ kind: "one", section })
  }
  return parts
}

/** The text's own heading, when the shop gave it one: an h2 under the page's one h1. */
function Titled({
  article,
  children,
}: {
  article: PageArticleView | PageFaqView
  children: ReactNode
}) {
  if (!article.title) {
    return children
  }
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <h2 id={headingId(article.id)} {...fieldMark(article.editor, "title")}>
        {article.title}
      </h2>
      {children}
    </div>
  )
}

/** The payment facts' box beside a text: the ways to pay (their mark there, when there are any). */
function PaymentsBeside({
  facts,
  t,
  suffix,
}: {
  facts: PagePaymentFactsView
  t: Translate
  suffix: string
}) {
  return facts.payments.marks.length > 0 ? (
    <Look id={facts.id} look={facts.look} device={facts.device}>
      <PaymentMarks marks={facts.payments.marks} t={t} suffix={suffix} />
    </Look>
  ) : null
}

/**
 * The page's text (`article`): a text of questions as grouped disclosures
 * with the ways to reach the shop beside them; a long text in a post's
 * reading column with its contents beside it (a closed well on a phone);
 * the facts that follow it beside it (the ways to pay, the carriers, the
 * promises) and the card families' installment rates across the page
 * under it; else the text in a reading measure.
 */
function Article({
  article,
  beside,
  t,
  ids,
}: {
  article: PageArticleView
  beside: Beside
  t: Translate
  ids: Suffixes
}) {
  const suffix = ids.get(article) ?? ""
  if (article.faq) {
    return (
      <Titled article={article}>
        <FaqBody faq={article.faq} help={article.help} t={t} suffix={suffix} />
      </Titled>
    )
  }
  const { payments, shipping } = beside
  const facts = payments !== null || shipping !== null
  const outline = !facts && hasOutline(article.outline) ? article.outline : []
  const prose = (
    <Prose
      html={article.html}
      tableLabel={(n) => t("content.table", { n })}
      mark={fieldMark(article.editor, "body")}
    />
  )
  if (outline.length > 0) {
    const reading = readingGrid({ outline: true, tablet: false })
    return (
      <Titled article={article}>
        <div className={`grid gap-8 ${reading.grid}`}>
          <OutlineWell outline={outline} t={t} />
          <OutlineAside
            id={`icindekiler${suffix}`}
            outline={outline}
            t={t}
            className={reading.side}
          />
          <article className={`min-w-0 ${reading.column}`}>{prose}</article>
        </div>
      </Titled>
    )
  }
  const installments = payments && payments.payments.installments.length > 0 ? payments : null
  const paySuffix = installments ? (ids.get(installments) ?? "") : ""
  return (
    <Titled article={article}>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
        <article className={facts ? "min-w-0 lg:col-span-7" : "min-w-0 lg:col-span-8"}>
          {prose}
        </article>
        {facts && (
          <div className="flex min-w-0 flex-col gap-(--gap-columns) lg:sticky lg:top-(--gf-stick-top) lg:col-span-5 lg:self-start">
            {payments && <PaymentsBeside facts={payments} t={t} suffix={ids.get(payments) ?? ""} />}
            {shipping && (
              <Look id={shipping.id} look={shipping.look} device={shipping.device}>
                <ShippingFacts facts={shipping.shipping} t={t} suffix={ids.get(shipping) ?? ""} />
              </Look>
            )}
          </div>
        )}
        {installments && (
          <div className="min-w-0 pt-(--space-xl) lg:col-span-12">
            {/* The payment facts' mark here when there were no ways to pay beside the text */}
            {installments.payments.marks.length > 0 ? (
              <InstallmentTable facts={installments.payments} t={t} suffix={paySuffix} />
            ) : (
              <Look id={installments.id} look={installments.look} device={installments.device}>
                <InstallmentTable facts={installments.payments} t={t} suffix={paySuffix} />
              </Look>
            )}
          </div>
        )}
      </div>
    </Titled>
  )
}

/** A text section not drawn beside a text: the contact page's body, or the facts across the page. */
function Alone({
  section,
  t,
  actions,
  suffix,
}: {
  section: Exclude<PageTextSectionView, PageArticleView>
  t: Translate
  actions?: ContactActions | undefined
  suffix: string
}) {
  switch (section.type) {
    case "faq":
      // The shop's own questions (adr/0073 Ek 2026-11-24 (2)), drawn as a text of questions was
      return (
        <Titled article={section}>
          <FaqBody
            faq={section.faq}
            help={section.help}
            t={t}
            suffix={suffix}
            settings={section.settings}
            sectionId={section.id}
          />
        </Titled>
      )
    case "contact":
      return <ContactBody section={section} t={t} actions={actions} suffix={suffix} />
    case "shipping_facts":
      return <ShippingFacts facts={section.shipping} t={t} suffix={suffix} />
    case "payment_facts":
      return (
        <div className="flex flex-col gap-(--gap-columns)">
          {section.payments.marks.length > 0 && (
            <PaymentMarks marks={section.payments.marks} t={t} suffix={suffix} />
          )}
          {section.payments.installments.length > 0 && (
            <InstallmentTable facts={section.payments} t={t} suffix={suffix} />
          )}
        </div>
      )
  }
}

/** A drawn part's section: the text's for a text with facts beside it. */
const partSection = (part: TextPart) => (part.kind === "article" ? part.article : part.section)

/** What each of a page's text sections adds to its fixed ids (`idSuffixes`). */
type Suffixes = ReadonlyMap<PageTextSectionView, string>

const NONE: Suffixes = new Map()

/**
 * A run of the page's text sections, each part in its look's box with its
 * mark; `ids` from all the page's text sections (`idSuffixes`), so two of
 * a kind across runs do not share their fixed ids.
 */
export function PageTexts({
  parts,
  t,
  actions,
  ids = NONE,
}: {
  parts: readonly TextPart[]
  t: Translate
  actions?: ContactActions | undefined
  ids?: Suffixes
}) {
  return parts.map((part) => {
    const section = partSection(part)
    return (
      <Look key={section.id} id={section.id} look={section.look} device={section.device}>
        {part.kind === "article" ? (
          <Article article={part.article} beside={part.beside} t={t} ids={ids} />
        ) : (
          <Alone
            section={part.section}
            t={t}
            actions={actions}
            suffix={ids.get(part.section) ?? ""}
          />
        )}
      </Look>
    )
  })
}
