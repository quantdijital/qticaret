import { Mail, Phone } from "lucide-react"
import { fieldMark } from "@qticaret/ui"
import type { ContactView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { type Of, headingId } from "./plan"

/** The ways to reach the shop as quiet pills: WhatsApp, the phone, the e-mail; each only when given. */
export function Reach({
  contact,
  t,
  label,
  className,
}: {
  contact: ContactView
  t: Translate
  /** The list's name for a screen reader, when no heading names it. */
  label?: string
  className?: string
}) {
  return (
    <ul
      aria-label={label}
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap ${className ?? ""}`}
    >
      {contact.whatsappHref && (
        <li>
          <a
            href={contact.whatsappHref}
            target="_blank"
            rel="noopener"
            className="gf-btn gf-btn--quiet w-full"
          >
            <WhatsAppGlyph className="text-whatsapp" />
            {t("home.help_whatsapp")}
          </a>
        </li>
      )}
      {contact.phone && contact.phoneHref && (
        <li>
          <a href={contact.phoneHref} className="gf-btn gf-btn--quiet tabular w-full">
            <Phone className="size-5" aria-hidden="true" strokeWidth={1.75} />
            {contact.phone}
          </a>
        </li>
      )}
      {contact.email && (
        <li>
          <a href={`mailto:${contact.email}`} className="gf-btn gf-btn--quiet w-full">
            <Mail className="size-5" aria-hidden="true" strokeWidth={1.75} />
            {contact.email}
          </a>
        </li>
      )}
    </ul>
  )
}

/**
 * "Ask us" (`help`): the shop's heading and line on the left, the ways to
 * reach it on the right as large pills: WhatsApp, the phone, the e-mail.
 */
export function Help({ section, t }: { section: Of<"help">; t: Translate }) {
  const id = headingId(section.id)
  const { contact } = section
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container>
        <div className="grid gap-6 rounded-tile border border-rule p-6 sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-(--gap-columns)">
          <div className="flex flex-col gap-3 lg:col-span-6">
            <h2 id={id} {...fieldMark(section.editor, "title")}>
              {section.title}
            </h2>
            <p className="text-text-2 lg:text-lead" {...fieldMark(section.editor, "text")}>
              {section.text}
            </p>
          </div>
          <Reach contact={contact} t={t} className="lg:col-span-6 lg:justify-end" />
        </div>
      </Container>
    </section>
  )
}
