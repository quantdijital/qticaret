import { Mail, MapPin, Phone } from "lucide-react"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { TrustStrip } from "../components/TrustStrip"
import { NewsletterForm } from "./NewsletterForm"

const NEWSLETTER_ERRORS = [
  "newsletter.email_invalid",
  "newsletter.rate_limited",
  "errors.challenge_failed",
]

/**
 * The footer: the shop's promises on the page's own ground, then a dark
 * band with its name and contact details, its link columns and profiles,
 * and the small print with its registered name.
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
    <footer className="mt-20 lg:mt-28">
      {shop.trustBadges.length > 0 && (
        <Container className="pb-12 lg:pb-16">
          <TrustStrip badges={shop.trustBadges} label={t("footer.trust")} />
        </Container>
      )}
      <div className="bg-ink text-ink-foreground">
        {subscribe && (
          <Container className="border-b border-ink-foreground/10 py-10 lg:py-12">
            <NewsletterForm
              action={subscribe}
              privacyPath={shop.privacyPath}
              words={{
                title: t("newsletter.title"),
                text: t("newsletter.text", { shop: shop.companyTitle ?? shop.name }),
                privacyLink: t("newsletter.privacy_link"),
                email: t("newsletter.email"),
                submit: t("newsletter.submit"),
                sent: t("newsletter.sent"),
                errors: Object.fromEntries(NEWSLETTER_ERRORS.map((key) => [key, t(key)])),
                fallback: t("newsletter.failed"),
              }}
            />
          </Container>
        )}
        <Container className="grid gap-12 py-14 lg:grid-cols-[1.3fr_2fr] lg:gap-16 lg:py-20">
          <section aria-labelledby="footer-contact" className="flex flex-col gap-6">
            <p className="font-heading text-3xl leading-tight lg:text-4xl">{shop.name}</p>
            <h2 id="footer-contact" className="sr-only">
              {t("footer.contact")}
            </h2>
            <ul className="flex flex-col gap-3 text-sm text-ink-muted">
              {contact.phone && contact.phoneHref && (
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  <a href={contact.phoneHref} className="tabular hover:text-ink-foreground">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  <a href={`mailto:${contact.email}`} className="hover:text-ink-foreground">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="max-w-xs">{contact.address}</span>
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
                      className="inline-flex rounded-full border border-ink-foreground/20 px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-ink-foreground hover:text-ink"
                    >
                      {profile.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {shop.footerGroups.length > 0 && (
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
              {shop.footerGroups.map((group) => (
                <nav key={group.title} aria-label={group.title} className="text-sm">
                  <h2 className="mb-5 font-sans text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
                    {group.title}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {group.links.map((link) => (
                      <li key={link.path}>
                        <a
                          href={link.path}
                          className="text-ink-foreground/90 underline-offset-4 hover:text-ink-foreground hover:underline"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          )}
        </Container>
        <div className="border-t border-ink-foreground/10">
          <Container className="flex flex-col gap-3 py-6 text-xs text-ink-muted">
            {shop.legalLinks.length > 0 && (
              <nav aria-label={t("footer.legal")}>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {shop.legalLinks.map((link) => (
                    <li key={link.path}>
                      <a href={link.path} className="hover:text-ink-foreground hover:underline">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {shop.identityLines.length > 0 && <p>{shop.identityLines.join(" · ")}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{t("footer.rights", { year, name: shop.companyTitle ?? shop.name })}</p>
              <p>{t("footer.secure_payment")}</p>
            </div>
          </Container>
        </div>
      </div>
    </footer>
  )
}
