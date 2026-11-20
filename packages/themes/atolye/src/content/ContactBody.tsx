import { Mail, MapPin, Phone } from "lucide-react"
import { fieldMark } from "@qticaret/ui"
import type {
  ContactActions,
  ContactView,
  IdentityRowView,
  PageContactView,
  Translate,
} from "@qticaret/ui"
import { placeholderWords } from "../parts/placeholders"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { ContactForm } from "./ContactForm"
import { CopyFact } from "./CopyFact"
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

/**
 * The shop's imprint (künye) as one compact card (owner 2026-11-05: the
 * long list "ekranı çok uzatıyor"): the registered facts side by side,
 * three to a row across the page from 1024 px (two beside the stage when
 * there is no form), two from 640 px, a tight stack on a phone; each
 * label small and muted over its value in the body's weight, only those
 * set. The MERSİS number, the tax number and the KEP address have a small
 * copy button after them.
 */
function Imprint({
  rows,
  t,
  wide,
}: {
  rows: readonly IdentityRowView[]
  t: Translate
  wide: boolean
}) {
  return (
    <section
      aria-labelledby="kunye"
      className="flex flex-col gap-4 rounded-tile gf-pane p-5 sm:p-6 lg:gap-5 lg:p-8"
    >
      <h2 id="kunye" className="text-title">
        {t("content.identity")}
      </h2>
      <dl
        className={`grid gap-x-8 gap-y-3 sm:grid-cols-2 sm:gap-y-5 ${wide ? "lg:grid-cols-3" : ""}`}
      >
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm text-text-3">{row.label}</dt>
            <dd className="flex items-center gap-1 text-text">
              <span className="min-w-0 break-words">{row.value}</span>
              {row.copy && (
                <CopyFact
                  value={row.copy.value}
                  label={row.copy.label}
                  copiedWord={t("content.identity_copied")}
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * The shop's contact page (adr/0047, adr/0048; the `contact` section,
 * adr/0073 Ek 2026-11-19 (2) K2): its own words first, the ways to reach
 * it on a graphite stage, the form, then its imprint; from 1024 px the
 * words and the stage in a column beside the form, the imprint one
 * compact card across the page under both (beside the stage when there is
 * no form).
 */
export function ContactBody({
  section,
  t,
  actions,
}: {
  section: PageContactView
  t: Translate
  actions?: ContactActions | undefined
}) {
  const identity = section.identity
  const form = section.form && actions ? section.form : null
  return (
    <div className="grid gap-(--gap-columns) lg:grid-cols-12 lg:items-start">
      <div className="flex min-w-0 flex-col gap-(--gap-columns) lg:col-span-5">
        <Prose html={section.html} className="mb-4" mark={fieldMark(section.editor, "body")} />
        {section.contact && <Reach contact={section.contact} t={t} />}
      </div>
      {form && actions && (
        <div className="min-w-0 lg:col-span-7">
          <ContactForm view={form} action={actions.sendContact} words={contactWords(t)} />
        </div>
      )}
      {identity.length > 0 && (
        <div className={form ? "min-w-0 lg:col-span-12" : "min-w-0 lg:col-span-7"}>
          <Imprint rows={identity} t={t} wide={form !== null} />
        </div>
      )}
    </div>
  )
}
