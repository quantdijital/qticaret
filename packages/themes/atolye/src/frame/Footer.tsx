import { Mail, MapPin, Phone } from "lucide-react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { CookiePreferencesLink } from "./CookiePreferencesLink"
import { FooterLinks } from "./FooterLinks"
import { FooterMarks } from "./FooterMarks"
import { NewsletterForm } from "./NewsletterForm"
import { newsletterWords } from "./newsletter-words"

const SMALL_LINK =
  "inline-flex min-h-11 items-center whitespace-nowrap text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-8"
const LINE =
  "inline-flex min-h-11 items-center gap-3 text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-9"

/** How the shop is reached: its name, registered title when it differs, address, phone, e-mail, profiles. */
function Contact({ shop, t }: { shop: ShopView; t: Translate }) {
  const { contact } = shop
  const title = shop.companyTitle ?? shop.name
  return (
    <section aria-labelledby="footer-contact" className="flex flex-col gap-4 lg:col-span-4">
      <h2
        id="footer-contact"
        className="text-wordmark leading-tight font-extrabold tracking-(--tracking-display)"
      >
        {shop.name}
      </h2>
      <ul className="flex flex-col text-sm">
        {title !== shop.name && <li className="pb-1 font-semibold text-text">{title}</li>}
        {contact.address && (
          <li className="flex items-start gap-3 py-2 text-text-2">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
            <span className="max-w-[36ch]">{contact.address}</span>
          </li>
        )}
        {contact.phone && contact.phoneHref && (
          <li>
            <a href={contact.phoneHref} className={`${LINE} tabular`}>
              <Phone className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              {contact.phone}
            </a>
          </li>
        )}
        {contact.email && (
          <li>
            <a href={`mailto:${contact.email}`} className={`${LINE} break-all`}>
              <Mail className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              {contact.email}
            </a>
          </li>
        )}
      </ul>
      {shop.social.length > 0 && (
        <ul aria-label={t("footer.social")} className="flex flex-wrap gap-2">
          {shop.social.map((profile) => (
            <li key={profile.href}>
              <a
                href={profile.href}
                rel="noopener me"
                target="_blank"
                className="inline-flex min-h-11 items-center rounded-pill border border-rule bg-field px-4 text-sm font-semibold no-underline hover:border-edge"
              >
                {profile.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The footer, compact on the steel well (docs/tema/yon-2026-11-05.md §
 * Alt bilgi), one ledger of two columns from 1024 px: first a slim row
 * with the newsletter's heading and its field (when the shop keeps one;
 * its consent shows once the visitor starts on it), then the shop's
 * contact on the left and its footer menus as short columns on the right
 * (closed groups on a phone), then under a rule the marks (ways to pay,
 * carriers, the ETBİS code) and the small print: the legal texts in one
 * wrapping line with the cookie choices, each identity line (6563,
 * ETBİS), and the year with the title on its own line. The hours are on
 * the contact page.
 */
export function Footer({
  shop,
  t,
  subscribe,
}: {
  shop: ShopView
  t: Translate
  subscribe?: ((state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>) | undefined
}) {
  const year = new Date().getFullYear()
  const title = shop.companyTitle ?? shop.name
  return (
    <footer className="mt-(--footer-gap) border-t border-rule bg-paper-2">
      <Container className="grid gap-10 pt-12 pb-8 lg:grid-cols-12 lg:gap-x-(--gap-columns) lg:gap-y-12 lg:pt-16">
        {subscribe && shop.newsletter && (
          <section
            aria-labelledby="bulten"
            className="grid gap-4 border-b border-rule pb-10 lg:col-span-12 lg:grid-cols-12 lg:items-start lg:gap-(--gap-columns) lg:pb-12"
          >
            <h2 id="bulten" className="max-w-[24ch] text-title lg:col-span-4 lg:pt-8">
              {shop.newsletter.title}
            </h2>
            <NewsletterForm
              id="bulten-alt"
              quiet
              action={subscribe}
              privacyPath={shop.privacyPath}
              words={newsletterWords(t, shop.newsletter.text)}
              className="lg:col-span-6"
            />
          </section>
        )}
        <Contact shop={shop} t={t} />
        <div className="lg:col-span-8">
          <FooterLinks groups={shop.footerGroups} />
        </div>
        <div className="flex flex-col gap-6 border-t border-rule pt-8 lg:col-span-12">
          <FooterMarks shop={shop} t={t} />
          <nav aria-label={t("footer.legal")}>
            <ul className="flex flex-wrap gap-x-6 text-sm">
              {shop.legalLinks.map((link) => (
                <li key={link.path}>
                  <a href={link.path} className={SMALL_LINK}>
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <CookiePreferencesLink label={t("cookies.preferences")} className={SMALL_LINK} />
              </li>
            </ul>
          </nav>
          {shop.identityLines.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-3">
              {shop.identityLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p className="border-t border-rule pt-6 text-xs text-text-3">
            {t("footer.copyright", { year, name: title })}
          </p>
        </div>
      </Container>
    </footer>
  )
}
