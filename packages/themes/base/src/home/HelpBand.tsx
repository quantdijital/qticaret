import { Mail, MessageCircle, Phone } from "lucide-react"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { headingId } from "./SectionHead"

type Help = Extract<HomeSectionView, { type: "help" }>

/** The dark band that invites a question: WhatsApp, phone and e-mail, whichever the shop gave. */
export function HelpBand({ section, t }: { section: Help; t: Translate }) {
  const { contact } = section
  const id = headingId(section.id)
  return (
    <section
      aria-labelledby={id}
      className="grid gap-8 overflow-hidden rounded-3xl bg-ink px-6 py-10 text-ink-foreground sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-14 lg:py-14"
    >
      <div className="flex flex-col gap-3">
        <h2 id={id} className="text-3xl leading-tight lg:text-4xl">
          {section.title}
        </h2>
        <p className="max-w-lg text-ink-muted">{section.text}</p>
      </div>
      <ul className="flex flex-wrap gap-3 lg:justify-end">
        {contact.whatsappHref && (
          <li>
            <a
              href={contact.whatsappHref}
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink-foreground px-6 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {t("home.help_whatsapp")}
            </a>
          </li>
        )}
        {contact.phone && contact.phoneHref && (
          <li>
            <a
              href={contact.phoneHref}
              className="tabular inline-flex h-12 items-center gap-2 rounded-full border border-ink-foreground/25 px-6 text-sm font-semibold transition-colors hover:bg-ink-foreground/10"
            >
              <Phone className="size-4" aria-hidden="true" />
              {contact.phone}
            </a>
          </li>
        )}
        {contact.email && (
          <li>
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-ink-foreground/25 px-6 text-sm font-semibold transition-colors hover:bg-ink-foreground/10"
            >
              <Mail className="size-4" aria-hidden="true" />
              {contact.email}
            </a>
          </li>
        )}
      </ul>
    </section>
  )
}
