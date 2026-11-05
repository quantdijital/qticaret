import { Clock, Mail, MapPin, Phone } from "lucide-react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { TrustStrip } from "../components/TrustStrip"
import { CookiePreferencesLink } from "./CookiePreferencesLink"
import { FooterMarks } from "./FooterMarks"
import { NewsletterForm, newsletterWords } from "./NewsletterForm"

const HEAD = "max-w-none font-body text-sm font-medium tracking-normal text-band-text-2"
const LINK = "at-band-link min-h-11 py-2"

/**
 * The footer (design.md § Footer), a mast: the shop's promises as a ruled
 * row on the page's paper, then the dark band with the shop's name set
 * large over its contact details, its link columns (the footer menus),
 * its profiles in words and the newsletter box when the shop keeps one;
 * then the small print: the legal pages, each identity line on a line of
 * its own (6563, ETBİS), the ETBİS QR code and the ways to pay and the
 * carriers as text badges when the shop has them, and the year with the
 * registered name.
 */
export function SiteFooter({
  shop,
  t,
  subscribe,
}: {
  shop: ShopView
  t: Translate
  subscribe?: ((state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>) | undefined
}) {
  const { contact } = shop
  const year = new Date().getFullYear()
  return (
    <footer className="mt-(--section-gap)">
      {shop.trustBadges.length > 0 && (
        <Container className="pb-10">
          <TrustStrip badges={shop.trustBadges} label={t("footer.trust")} />
        </Container>
      )}
      <div className="at-band bg-band text-band-text">
        <Container className="flex flex-col gap-10 pt-16 pb-10 lg:gap-16 lg:pt-24">
          <p className="font-display text-mast leading-none tracking-(--tracking-display)">
            {shop.name}
          </p>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-(--gap-columns)">
            <section aria-labelledby="footer-contact" className="flex flex-col gap-4 lg:col-span-4">
              <h2 id="footer-contact" className={HEAD}>
                {t("footer.contact")}
              </h2>
              <ul className="flex flex-col gap-1 text-md">
                {contact.phone && contact.phoneHref && (
                  <li>
                    <a href={contact.phoneHref} className={`${LINK} tabular gap-3`}>
                      <Phone className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className={`${LINK} gap-3 break-all`}>
                      <Mail className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="flex items-start gap-3 py-2">
                    <MapPin
                      className="mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                    <span className="max-w-[32ch]">{contact.address}</span>
                  </li>
                )}
                {contact.hours.length > 0 && (
                  <li className="flex items-start gap-3 py-2">
                    <Clock
                      className="mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                    <dl className="grid grid-cols-[auto_auto] gap-x-4 text-band-text-2">
                      {contact.hours.map((line) => (
                        <div key={line.days} className="contents">
                          <dt>{line.days}</dt>
                          <dd className="tabular">{line.hours}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                )}
              </ul>
              {shop.social.length > 0 && (
                <ul aria-label={t("footer.social")} className="flex flex-wrap gap-x-4">
                  {shop.social.map((profile) => (
                    <li key={profile.href}>
                      <a href={profile.href} rel="noopener me" target="_blank" className={LINK}>
                        {profile.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {shop.footerGroups.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:col-span-8 lg:gap-x-(--gap-columns)">
                {shop.footerGroups.map((group) => (
                  <nav key={group.title} aria-label={group.title} className="flex flex-col gap-2">
                    <h2 className={HEAD}>{group.title}</h2>
                    <ul className="flex flex-col text-sm">
                      {group.links.map((link) => (
                        <li key={link.path}>
                          <a href={link.path} className={LINK}>
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ))}
              </div>
            )}
            {subscribe && shop.newsletter && (
              <div className="lg:col-span-6 lg:col-start-5">
                <NewsletterForm
                  action={subscribe}
                  privacyPath={shop.privacyPath}
                  words={newsletterWords(t, shop.newsletter.title, shop.newsletter.text)}
                />
              </div>
            )}
          </div>
        </Container>
        <div className="border-t border-band-rule">
          <Container className="flex flex-col gap-4 py-6 text-sm text-band-text-2">
            <nav aria-label={t("footer.legal")}>
              <ul className="flex flex-wrap gap-x-6">
                {shop.legalLinks.map((link) => (
                  <li key={link.path}>
                    <a href={link.path} className={LINK}>
                      {link.label}
                    </a>
                  </li>
                ))}
                {/* The cookie answer can always be changed (D9, KVKK) */}
                <li>
                  <CookiePreferencesLink label={t("cookies.preferences")} className={LINK} />
                </li>
              </ul>
            </nav>
            {shop.identityLines.length > 0 && (
              <ul className="flex flex-col gap-1">
                {shop.identityLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <FooterMarks shop={shop} t={t} />
            <p>{t("footer.copyright", { year, name: shop.companyTitle ?? shop.name })}</p>
          </Container>
        </div>
      </div>
    </footer>
  )
}
