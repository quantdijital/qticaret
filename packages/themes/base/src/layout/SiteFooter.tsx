import { Mail, MapPin, Phone } from "lucide-react"
import type { ShopView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { TrustStrip } from "../components/TrustStrip"

/**
 * The footer: the shop's promises, its contact details and profiles, its
 * link columns, and the small print with its registered name.
 */
export function SiteFooter({ shop, t }: { shop: ShopView; t: Translate }) {
  const { contact } = shop
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 border-t bg-muted/60">
      {shop.trustBadges.length > 0 && (
        <div className="border-b">
          <Container className="py-8">
            <TrustStrip badges={shop.trustBadges} label={t("footer.trust")} />
          </Container>
        </div>
      )}
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <section aria-labelledby="footer-contact" className="flex flex-col gap-4 text-sm">
          <p className="text-lg font-semibold tracking-tight">{shop.name}</p>
          <h2 id="footer-contact" className="sr-only">
            {t("footer.contact")}
          </h2>
          <ul className="flex flex-col gap-2.5 text-muted-foreground">
            {contact.phone && contact.phoneHref && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                <a href={contact.phoneHref} className="hover:text-foreground">
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                  {contact.email}
                </a>
              </li>
            )}
            {contact.address && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{contact.address}</span>
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
                    className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
                  >
                    {profile.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
        {shop.footerGroups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="text-sm">
            <h2 className="mb-4 font-semibold">{group.title}</h2>
            <ul className="flex flex-col gap-2.5 text-muted-foreground">
              {group.links.map((link) => (
                <li key={link.path}>
                  <a href={link.path} className="hover:text-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t">
        <Container className="py-6 text-xs text-muted-foreground">
          {t("footer.rights", { year, name: shop.companyTitle ?? shop.name })}
        </Container>
      </div>
    </footer>
  )
}
