import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react"
import type { ContactView, Translate } from "@qticaret/ui"

/**
 * How to reach the shop, on its contact page (adr/0048): its phone, e-mail,
 * WhatsApp, address with a map link and hours, all from its store details,
 * so the page's own text never repeats them. Nothing given: nothing shown.
 */
export function ContactDetails({ contact, t }: { contact: ContactView; t: Translate }) {
  const given =
    [contact.phone, contact.email, contact.whatsappHref, contact.address].some(Boolean) ||
    contact.hours.length > 0
  if (!given) {
    return null
  }
  return (
    <section aria-labelledby="iletisim-bilgileri" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2 id="iletisim-bilgileri" className="font-heading text-2xl">
        {t("contact.info_title")}
      </h2>
      <dl className="mt-6 grid gap-6 sm:grid-cols-2">
        {contact.phone && contact.phoneHref && (
          <div className="flex gap-3">
            <Phone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted-foreground">{t("contact.info_phone")}</dt>
              <dd>
                <a href={contact.phoneHref} className="tabular font-medium hover:underline">
                  {contact.phone}
                </a>
              </dd>
            </div>
          </div>
        )}
        {contact.email && (
          <div className="flex gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted-foreground">{t("contact.info_email")}</dt>
              <dd>
                <a href={`mailto:${contact.email}`} className="font-medium hover:underline">
                  {contact.email}
                </a>
              </dd>
            </div>
          </div>
        )}
        {contact.address && (
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted-foreground">{t("contact.info_address")}</dt>
              <dd className="flex flex-col gap-1">
                <span>{contact.address}</span>
                {contact.mapHref && (
                  <a
                    href={contact.mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    {t("contact.info_map")}
                  </a>
                )}
              </dd>
            </div>
          </div>
        )}
        {contact.hours.length > 0 && (
          <div className="flex gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted-foreground">{t("contact.info_hours")}</dt>
              <dd>
                <ul className="flex flex-col gap-0.5">
                  {contact.hours.map((line) => (
                    <li key={line.days} className="flex flex-wrap gap-x-2">
                      <span>{line.days}:</span>
                      <span className="tabular">{line.hours}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </div>
        )}
      </dl>
      {contact.whatsappHref && (
        <a
          href={contact.whatsappHref}
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-button bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {t("contact.info_whatsapp")}
        </a>
      )}
    </section>
  )
}
