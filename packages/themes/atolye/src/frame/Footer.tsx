import { Mail, MapPin, Phone } from "lucide-react"
import { ResponsiveImage, drawnVariant, fieldMark, sectionMark } from "@qticaret/ui"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { FooterLinks } from "./FooterLinks"
import { FooterMarks } from "./FooterMarks"
import { FooterSocial } from "./FooterSocial"
import { NewsletterForm } from "./NewsletterForm"
import { newsletterWords } from "./newsletter-words"
import { SmallPrint } from "./SmallPrint"

const LINE =
  "inline-flex min-h-11 items-center gap-3 text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-9"

/**
 * How the shop is reached: its name (or the store profile's logo, when the
 * shop chose it in the footer: `footerBar.logo`, the image's alt text the
 * heading's name), registered title when it differs, address, phone,
 * e-mail, profiles (`FooterSocial`).
 */
function Contact({ shop, t }: { shop: ShopView; t: Translate }) {
  const { contact } = shop
  const title = shop.companyTitle ?? shop.name
  const logo = shop.footerBar?.logo
  return (
    <section aria-labelledby="footer-contact" className="flex flex-col gap-4 lg:col-span-4">
      {logo ? (
        // The header's logo box: 40 px tall, as wide as its shape, at most 14rem
        <h2 id="footer-contact" className="flex min-h-11 items-center">
          <ResponsiveImage
            image={logo}
            sizes="224px"
            className="h-10 w-auto max-w-56 object-contain object-left"
          />
        </h2>
      ) : (
        <h2
          id="footer-contact"
          className="text-wordmark leading-tight font-extrabold tracking-(--tracking-display)"
        >
          {shop.name}
        </h2>
      )}
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
      <FooterSocial
        profiles={shop.social}
        style={shop.footerBar?.social ?? "text"}
        label={t("footer.social")}
      />
    </section>
  )
}

/**
 * The footer, compact on the steel well (docs/tema/yon-2026-11-05.md §
 * Alt bilgi), one ledger of two columns from 1024 px: first a slim row
 * with the newsletter's heading and its field (when the shop keeps one;
 * its consent shows once the visitor starts on it), then the shop's
 * contact on the left and its footer menus as short columns on the right
 * (closed groups on a phone), then the bottom zone under a rule (sahip
 * 2026-11-06): one band of marks (ways to pay and carriers in one row,
 * the ETBİS code at its end), the legal texts (a closed row on a phone,
 * four short columns from 1024 px) and one muted line with the year, the
 * title and the identity lines, "Yukarı çık" at its end. The hours are
 * on the contact page.
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
  // The design's footer (adr/0049 Ek 2026-11-14 §5): today's ledger, every variant falls to it
  const variant = drawnVariant("footer_bar", shop.footerBar?.variant, ["ledger"])
  return (
    <footer
      data-gf-clear=""
      {...sectionMark(shop.footerBar?.id)}
      data-variant={variant}
      className="mt-(--footer-gap) border-t border-rule bg-paper-2"
    >
      <Container className="grid gap-10 pt-12 pb-8 lg:grid-cols-12 lg:gap-x-(--gap-columns) lg:gap-y-12 lg:pt-16">
        {subscribe && shop.newsletter && (
          <section
            aria-labelledby="bulten"
            {...sectionMark(shop.newsletter.mark)}
            className="grid gap-4 border-b border-rule pb-10 lg:col-span-12 lg:grid-cols-12 lg:items-start lg:gap-(--gap-columns) lg:pb-12"
          >
            <h2
              id="bulten"
              className="max-w-[24ch] text-title lg:col-span-4 lg:pt-8"
              {...fieldMark(Boolean(shop.newsletter.mark), "title")}
            >
              {shop.newsletter.title}
            </h2>
            <NewsletterForm
              id="bulten-alt"
              quiet
              action={subscribe}
              privacyPath={shop.privacyPath}
              words={newsletterWords(t, shop.newsletter.text)}
              marks={Boolean(shop.newsletter.mark)}
              className="lg:col-span-6"
            />
          </section>
        )}
        <Contact shop={shop} t={t} />
        <div className="lg:col-span-8">
          <FooterLinks groups={shop.footerGroups} />
        </div>
        <div
          data-footer-bottom=""
          className={`flex flex-col border-t border-rule lg:col-span-12 lg:block ${shop.footerGroups.length > 0 ? "max-lg:-mt-10 max-lg:border-t-0" : ""}`}
        >
          <FooterMarks shop={shop} t={t} />
          <SmallPrint shop={shop} t={t} />
        </div>
      </Container>
    </footer>
  )
}
