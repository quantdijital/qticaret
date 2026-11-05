import { Mail, MapPin, Phone } from "lucide-react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { CookiePreferencesLink } from "./CookiePreferencesLink"
import { FooterMarks } from "./FooterMarks"
import { NewsletterForm } from "./NewsletterForm"
import { newsletterWords } from "./newsletter-words"

const HEAD = "max-w-none text-sm font-semibold tracking-normal text-stage-text-2"
const LINK =
  "inline-flex min-h-11 items-center gap-3 py-1 no-underline hover:underline underline-offset-4"

/**
 * The footer, a graphite mast: the newsletter when the shop keeps one
 * (its own band at the top), the shop's name set large, then its contact
 * (registered title when it is not the name, address, phone, e-mail,
 * profiles) beside its link columns (the footer menus); under a rule the
 * small print: the marks (ways to pay, carriers, the ETBİS code), the
 * legal pages, each identity line on its own line (6563, ETBİS) and the
 * year with the title. The hours are on the contact page.
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
  const { contact } = shop
  const year = new Date().getFullYear()
  const title = shop.companyTitle ?? shop.name
  return (
    <footer className="gf-stage mt-(--section-gap)">
      {subscribe && shop.newsletter && (
        <section aria-labelledby="bulten" className="border-b border-stage-rule">
          <Container className="grid gap-6 py-12 lg:grid-cols-12 lg:items-center lg:gap-(--gap-columns) lg:py-16">
            <h2 id="bulten" className="lg:col-span-5">
              {shop.newsletter.title}
            </h2>
            <NewsletterForm
              id="bulten-alt"
              action={subscribe}
              privacyPath={shop.privacyPath}
              words={newsletterWords(t, shop.newsletter.text)}
              className="lg:col-span-6 lg:col-start-7"
            />
          </Container>
        </section>
      )}
      <Container className="flex flex-col gap-10 pt-14 pb-10 lg:gap-14 lg:pt-20">
        <p className="font-display text-mast leading-none font-extrabold tracking-(--tracking-display)">
          {shop.name}
        </p>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-(--gap-columns)">
          <section aria-labelledby="footer-contact" className="flex flex-col gap-3 lg:col-span-4">
            <h2 id="footer-contact" className={HEAD}>
              {t("footer.contact")}
            </h2>
            <ul className="flex flex-col text-md">
              {title !== shop.name && <li className="pb-1 font-semibold">{title}</li>}
              {contact.address && (
                <li className="flex items-start gap-3 py-2">
                  <MapPin
                    className="mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                    strokeWidth={1.75}
                  />
                  <span className="max-w-[32ch]">{contact.address}</span>
                </li>
              )}
              {contact.phone && contact.phoneHref && (
                <li>
                  <a href={contact.phoneHref} className={`${LINK} tabular`}>
                    <Phone className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className={`${LINK} break-all`}>
                    <Mail className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
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
                      className="inline-flex min-h-11 items-center rounded-pill bg-stage-2 px-4 text-sm font-semibold no-underline hover:bg-stage-rule"
                    >
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
        </div>
      </Container>
      <div className="border-t border-stage-rule">
        <Container className="flex flex-col gap-4 py-6 text-sm text-stage-text-2">
          <FooterMarks shop={shop} t={t} />
          <nav aria-label={t("footer.legal")}>
            <ul className="flex flex-wrap gap-x-6">
              {shop.legalLinks.map((link) => (
                <li key={link.path}>
                  <a href={link.path} className={LINK}>
                    {link.label}
                  </a>
                </li>
              ))}
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
          <p>{t("footer.copyright", { year, name: title })}</p>
        </Container>
      </div>
    </footer>
  )
}
