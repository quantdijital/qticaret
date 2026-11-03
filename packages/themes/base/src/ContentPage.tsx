import type { ContactActions, ContentPageView, LinkView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { ContactDetails } from "./components/ContactDetails"
import { ContactForm } from "./components/ContactForm"
import type { ContactWords } from "./components/ContactForm"
import { PageContainer } from "./components/Container"
import { RichText } from "./components/RichText"

const CONTACT_ERRORS = [
  "contact.rate_limited",
  "contact.email_domain",
  "contact.phone_invalid",
  "contact.invalid",
  "errors.challenge_failed",
]

const contactWords = (t: Translate): ContactWords => ({
  title: t("contact.title"),
  name: t("contact.name"),
  email: t("contact.email"),
  phone: t("contact.phone"),
  optional: t("contact.optional"),
  subject: t("contact.subject"),
  orderNumber: t("contact.order_number"),
  body: t("contact.body"),
  privacy: t("contact.privacy"),
  privacyLink: t("contact.privacy_link"),
  submit: t("contact.submit"),
  checking: t("contact.checking"),
  sent: t("contact.sent"),
  errors: Object.fromEntries(CONTACT_ERRORS.map((key) => [key, t(key)])),
  fallback: t("contact.failed"),
})

/** A post's tags under its text, each a link to its archive. */
function Tags({ tags, t }: { tags: LinkView[]; t: Translate }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-sm font-semibold text-muted-foreground">{t("blog.tags")}</h2>
      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag.path}>
            <a
              href={tag.path}
              className="inline-flex h-10 items-center rounded-button border bg-card px-4 text-sm font-medium transition-colors hover:border-foreground"
            >
              {tag.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A content page or a blog post: the backend's sanitised HTML in a
 * readable column; on the shop's contact page, how to reach the shop (its
 * store details) and the contact form below.
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
  return (
    <PageContainer>
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        {view.notice && (
          <p role="status" className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
            {view.notice}
          </p>
        )}
        <header className="flex flex-col gap-5 border-b pb-8">
          <Breadcrumbs items={view.breadcrumbs} t={t} />
          {view.category && (
            <p className="text-sm">
              <span className="text-muted-foreground">{t("blog.category")}: </span>
              <a
                href={view.category.path}
                className="font-semibold underline underline-offset-4 hover:no-underline"
              >
                {view.category.label}
              </a>
            </p>
          )}
          <h1 className="text-4xl leading-[1.08] text-balance lg:text-5xl">{view.title}</h1>
        </header>
        <RichText html={view.html} />
        {view.tags && view.tags.length > 0 && <Tags tags={view.tags} t={t} />}
        {view.contact && <ContactDetails contact={view.contact} t={t} />}
        {view.contactForm && actions && (
          <ContactForm
            view={view.contactForm}
            action={actions.sendContact}
            words={contactWords(t)}
          />
        )}
      </article>
    </PageContainer>
  )
}
