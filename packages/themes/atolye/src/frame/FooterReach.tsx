import { Mail, Phone } from "lucide-react"
import type { ReactNode } from "react"
import type { ContactView, ShopView, Translate } from "@qticaret/ui"
import type { FooterContactIconStyle } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"

/**
 * An e-mail address that breaks after its `@` when its column is narrow,
 * not in the middle of a word; a value without one as it is.
 */
function Breakable({ value }: { value: string }) {
  const at = value.indexOf("@")
  if (at < 1) {
    return value
  }
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  )
}

/**
 * One way to reach the shop. `boxed`: its kind small above, the address
 * itself in the body's weight, a 40 px round sign before them; `inline`:
 * a small sign in the line and the address in the body's text, the kind
 * read out only (as the contact block's address line beside it).
 */
function Reach({
  href,
  kind,
  value,
  icon,
  external = false,
  inline,
}: {
  href: string
  kind: string
  value: string
  icon: ReactNode
  external?: boolean
  inline: boolean
}) {
  const away = external ? { target: "_blank", rel: "noopener noreferrer" } : {}
  if (inline) {
    return (
      <li className="min-w-0">
        <a
          href={href}
          {...away}
          className="flex min-h-11 items-center gap-3 text-sm text-text-2 no-underline transition-colors duration-(--dur-micro) hover:text-text lg:pointer-fine:min-h-8"
        >
          <span className="flex shrink-0 text-text">{icon}</span>
          <span className="min-w-0 wrap-break-word">
            <span className="sr-only">{kind}: </span>
            <Breakable value={value} />
          </span>
        </a>
      </li>
    )
  }
  return (
    <li className="min-w-0">
      <a
        href={href}
        {...away}
        className="group/reach flex min-h-11 items-center gap-3 text-text no-underline"
      >
        <span className="gf-reach-sign">{icon}</span>
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-text-3">{kind}</span>
          <span className="font-semibold wrap-anywhere transition-colors duration-(--dur-micro) group-hover/reach:text-text-2">
            <Breakable value={value} />
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
  contact = shop.contact,
  iconStyle = "boxed",
}: {
  shop: ShopView
  t: Translate
  className?: string
  /** The ways a free rows footer's contact block keeps (adr/0070); absent: the shop's. */
  contact?: Pick<ContactView, "phone" | "phoneHref" | "whatsappHref" | "email">
  /** The contact block's signs; absent: the round boxes. */
  iconStyle?: FooterContactIconStyle
}) {
  if (!contact.phoneHref && !contact.whatsappHref && !contact.email) {
    return null
  }
  const inline = iconStyle === "inline"
  const sign = "size-4"
  return (
    <ul
      aria-label={t("footer.reach")}
      {...(inline ? { "data-icons": "inline" } : {})}
      className={cn(inline ? "flex flex-col gap-1" : "gf-reach", className)}
    >
      {contact.phone && contact.phoneHref && (
        <Reach
          href={contact.phoneHref}
          kind={t("footer.reach_phone")}
          value={contact.phone}
          icon={<Phone className={sign} aria-hidden="true" strokeWidth={2} />}
          inline={inline}
        />
      )}
      {contact.whatsappHref && (
        <Reach
          href={contact.whatsappHref}
          kind={t("footer.reach_whatsapp")}
          value={t("footer.reach_whatsapp_value")}
          icon={<WhatsAppGlyph className={sign} />}
          external
          inline={inline}
        />
      )}
      {contact.email && (
        <Reach
          href={`mailto:${contact.email}`}
          kind={t("footer.reach_email")}
          value={contact.email}
          icon={<Mail className={sign} aria-hidden="true" strokeWidth={2} />}
          inline={inline}
        />
      )}
    </ul>
  )
}
