import { Mail, MapPin, Phone } from "lucide-react"
import type {
  ContactActions,
  ContactView,
  ContentPageView,
  IdentityRowView,
  Translate,
} from "@qticaret/ui"
import { placeholderWords } from "../parts/placeholders"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { ContactForm } from "./ContactForm"
import type { ContactWords } from "./ContactForm"
import { Prose } from "./Prose"

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
  placeholders: placeholderWords(t),
})

/**
 * The ways to reach the shop on a graphite stage: WhatsApp first (the
 * stage's own light button), the phone and the e-mail as pills, the
 * address with its map, the hours. Each only when the shop gave it.
 */
function Reach({ contact, t }: { contact: ContactView; t: Translate }) {
  return (
    <section
      aria-labelledby="bize-ulasin"
      className="gf-stage flex flex-col gap-6 rounded-tile p-6 sm:p-8"
    >
      <h2 id="bize-ulasin" className="text-title">
        {t("content.reach")}
      </h2>
      <ul className="flex flex-col gap-2">
        {contact.whatsappHref && (
          <li>
            <a href={contact.whatsappHref} target="_blank" rel="noopener" className="gf-btn w-full">
              <WhatsAppGlyph className="text-whatsapp" />
              {t("contact.info_whatsapp")}
            </a>
          </li>
        )}
        {contact.phone && contact.phoneHref && (
          <li>
            <a href={contact.phoneHref} className="gf-btn gf-btn--quiet tabular w-full">
              <Phone className="size-5" aria-hidden="true" strokeWidth={1.75} />
              <span className="sr-only">{t("contact.info_phone")}: </span>
              {contact.phone}
            </a>
          </li>
        )}
        {contact.email && (
          <li>
            <a href={`mailto:${contact.email}`} className="gf-btn gf-btn--quiet w-full">
              <Mail className="size-5" aria-hidden="true" strokeWidth={1.75} />
              <span className="sr-only">{t("contact.info_email")}: </span>
              <span className="truncate">{contact.email}</span>
            </a>
          </li>
        )}
      </ul>
      {contact.address && (
        <div className="flex items-start gap-3 border-t border-stage-rule pt-5">
          <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
          <div className="flex flex-col items-start gap-1">
            <p>
              <span className="sr-only">{t("contact.info_address")}: </span>
              {contact.address}
            </p>
            {contact.mapHref && (
              <a href={contact.mapHref} target="_blank" rel="noopener" className="gf-link text-sm">
                {t("contact.info_map")}
              </a>
            )}
          </div>
        </div>
      )}
      {contact.hours.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-stage-rule pt-5">
          <h3 className="text-md tracking-normal">{t("contact.info_hours")}</h3>
          <dl className="flex flex-col gap-1.5 text-sm">
            {contact.hours.map((line) => (
              <div key={line.days} className="flex justify-between gap-4">
                <dt className="text-stage-text-2">{line.days}</dt>
                <dd className="tabular font-semibold">{line.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}

/** The shop's imprint (künye) on a filled well: each registered fact on its own row, only those set. */
function Imprint({ rows, t }: { rows: readonly IdentityRowView[]; t: Translate }) {
  return (
    <section
      aria-labelledby="kunye"
      className="flex flex-col gap-4 rounded-tile bg-paper-2 p-6 sm:p-8"
    >
      <h2 id="kunye" className="text-title">
        {t("content.identity")}
      </h2>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 border-t border-rule py-3 first:border-t-0 first:pt-0 last:pb-0"
          >
            <dt className="text-sm text-text-3">{row.label}</dt>
            <dd className="font-semibold break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * The shop's contact page (adr/0047, adr/0048): its own words first, the
 * ways to reach it on a graphite stage, the form, then its imprint; from
 * 1024 px the stage and the imprint in a column beside the form.
 */
export function ContactBody({
  view,
  t,
  actions,
}: {
  view: ContentPageView
  t: Translate
  actions?: ContactActions | undefined
}) {
  const identity = view.identity ?? []
  const form = view.contactForm && actions ? view.contactForm : null
  return (
    <div className="grid gap-(--gap-columns) lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start">
      <div className="flex min-w-0 flex-col gap-(--gap-columns) lg:col-span-5 lg:row-start-1">
        <Prose html={view.html} className="mb-4" />
        {view.contact && <Reach contact={view.contact} t={t} />}
      </div>
      {form && actions && (
        <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <ContactForm view={form} action={actions.sendContact} words={contactWords(t)} />
        </div>
      )}
      {identity.length > 0 && (
        <div className="min-w-0 lg:col-span-5 lg:col-start-1 lg:row-start-2">
          <Imprint rows={identity} t={t} />
        </div>
      )}
    </div>
  )
}
