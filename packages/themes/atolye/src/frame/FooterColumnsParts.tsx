import { Banknote, CalendarRange, Landmark, Mail, MapPin, Phone, Plus } from "lucide-react"
import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { FooterGroupView, ShopMarkView, ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { FooterSocial } from "./FooterSocial"
import { legalLabel } from "./SmallPrint"

const LINK =
  "inline-flex min-h-11 items-center text-sm text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-8"

/**
 * One way to reach the shop in the strip: its kind small above, the
 * address itself in the body's weight, a 40 px round sign before them.
 */
function Reach({
  href,
  kind,
  value,
  icon,
  external = false,
}: {
  href: string
  kind: string
  value: string
  icon: ReactNode
  external?: boolean
}) {
  return (
    <li className="min-w-0">
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group/reach flex min-h-11 items-center gap-3 text-text no-underline"
      >
        <span className="gf-reach-sign">{icon}</span>
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-text-3">{kind}</span>
          <span className="truncate font-semibold group-hover/reach:underline underline-offset-4">
            {value}
          </span>
        </span>
      </a>
    </li>
  )
}

/** The shop's phone, WhatsApp and e-mail, those it filled in, as the strip's quick ways in. */
export function ReachList({
  shop,
  t,
  className,
}: {
  shop: ShopView
  t: Translate
  className?: string
}) {
  const { contact } = shop
  if (!contact.phoneHref && !contact.whatsappHref && !contact.email) {
    return null
  }
  const sign = "size-4"
  return (
    <ul aria-label={t("footer.reach")} className={cn("gf-reach", className)}>
      {contact.phone && contact.phoneHref && (
        <Reach
          href={contact.phoneHref}
          kind={t("footer.reach_phone")}
          value={contact.phone}
          icon={<Phone className={sign} aria-hidden="true" strokeWidth={2} />}
        />
      )}
      {contact.whatsappHref && (
        <Reach
          href={contact.whatsappHref}
          kind={t("footer.reach_whatsapp")}
          value={t("footer.reach_whatsapp_value")}
          icon={<WhatsAppGlyph className={sign} />}
          external
        />
      )}
      {contact.email && (
        <Reach
          href={`mailto:${contact.email}`}
          kind={t("footer.reach_email")}
          value={contact.email}
          icon={<Mail className={sign} aria-hidden="true" strokeWidth={2} />}
        />
      )}
    </ul>
  )
}

/**
 * The brand block: the shop's logo (or name), its own short line, the
 * address (with the phone and e-mail when the strip does not say them),
 * its profiles, then the identity lines the law asks for beside the
 * ETBİS code. `children`: the newsletter box when the strip is off.
 */
export function BrandBlock({
  shop,
  t,
  about,
  withContact,
  children,
}: {
  shop: ShopView
  t: Translate
  about: string | null
  withContact: boolean
  children?: ReactNode
}) {
  const { contact } = shop
  const logo = shop.footerBar?.logo
  const title = shop.companyTitle ?? shop.name
  const qr = shop.etbisQr ?? null
  return (
    <section aria-labelledby="footer-brand" className="flex flex-col gap-5 lg:col-span-4">
      {logo ? (
        <h2 id="footer-brand" className="flex min-h-11 items-center">
          <ResponsiveImage
            image={logo}
            sizes="224px"
            className="h-10 w-auto max-w-56 object-contain object-left"
          />
        </h2>
      ) : (
        <h2
          id="footer-brand"
          className="text-wordmark leading-tight font-extrabold tracking-(--tracking-display)"
        >
          {shop.name}
        </h2>
      )}
      {about && <p className="max-w-[40ch] text-sm text-text-2">{about}</p>}
      <ul className="flex flex-col text-sm">
        {contact.address && (
          <li className="flex items-start gap-3 py-2 text-text-2">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
            <span className="max-w-[36ch]">{contact.address}</span>
          </li>
        )}
        {withContact && contact.phone && contact.phoneHref && (
          <li>
            <a href={contact.phoneHref} className={cn(LINK, "tabular gap-3")}>
              <Phone className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              {contact.phone}
            </a>
          </li>
        )}
        {withContact && contact.email && (
          <li>
            <a href={`mailto:${contact.email}`} className={cn(LINK, "gap-3 break-all")}>
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
      {children}
      {(shop.identityLines.length > 0 || qr !== null || title !== shop.name) && (
        <div className="flex items-start gap-4">
          {qr && (
            <span className="block size-14 shrink-0 rounded-inner border border-rule bg-chip p-1">
              <ResponsiveImage
                image={{ ...qr, alt: t("footer.etbis_qr_alt") }}
                sizes="56px"
                className="h-full w-full object-contain"
              />
            </span>
          )}
          <ul className="flex flex-col gap-0.5 text-xs text-text-3">
            {title !== shop.name && <li className="font-semibold text-text-2">{title}</li>}
            {shop.identityLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

interface Column {
  title: string
  links: { path: string; label: string; title?: string }[]
}

/**
 * The link columns: the shop's footer menus, then its legal texts as one
 * more (the cookie choices stay on the bottom line). On a phone each is a
 * closed 52 px row that opens in place (44 px links); from 1024 px they
 * stand open, as many across as fit at 10rem each.
 */
export function LinkColumns({
  groups,
  shop,
  t,
}: {
  groups: readonly FooterGroupView[]
  shop: ShopView
  t: Translate
}) {
  const columns: Column[] = [
    ...groups.map((group) => ({ title: group.title, links: group.links })),
    ...(shop.legalLinks.length > 0
      ? [{ title: t("footer.legal"), links: shop.legalLinks.map((link) => legalLabel(link, t)) }]
      : []),
  ]
  if (columns.length === 0) {
    return null
  }
  const list = (column: Column) => (
    <ul className="flex flex-col">
      {column.links.map((link) => (
        <li key={link.path}>
          <a href={link.path} title={link.title} className={LINK}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="lg:col-span-8">
      <div className="border-t border-rule lg:hidden">
        {columns.map((column) => (
          <details key={column.title} className="group border-b border-rule">
            <summary className="flex min-h-13 cursor-pointer items-center justify-between gap-4 font-semibold">
              {column.title}
              <Plus
                className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open:rotate-45"
                aria-hidden="true"
                strokeWidth={1.75}
              />
            </summary>
            <nav aria-label={column.title} className="pb-3">
              {list(column)}
            </nav>
          </details>
        ))}
      </div>
      <div className="gf-foot-columns max-lg:hidden">
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-normal text-text">{column.title}</h2>
            {list(column)}
          </nav>
        ))}
      </div>
    </div>
  )
}

/** Ways to pay with no company's mark: an icon beside their name. */
const ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  cash_on_delivery: Banknote,
  installments: CalendarRange,
}

/**
 * A row of marks: a card network or a provider by its own file, untouched
 * (on its white card, or straight on a light ground: `data-badges`), never
 * a link; a way to pay that is no company's by an icon and its name.
 */
export function MarkList({ marks, label }: { marks: readonly ShopMarkView[]; label: string }) {
  if (marks.length === 0) {
    return null
  }
  return (
    <ul aria-label={label} className="gf-pay">
      {marks.map((mark) => {
        const Icon = ICONS[mark.key]
        return (
          <li key={mark.key} data-mark={mark.key} {...(mark.logo ? { "data-logo": "" } : {})}>
            {mark.logo ? (
              <img
                src={mark.logo.src}
                alt={mark.label}
                width={mark.logo.width}
                height={mark.logo.height}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <>
                {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />}
                {mark.label}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
