import { ArrowUp, Plus } from "lucide-react"
import type { LinkView, ShopView, Translate } from "@qticaret/ui"
import { CookiePreferencesLink } from "./CookiePreferencesLink"

const PHONE_LINK =
  "flex min-h-11 items-center text-sm text-text-2 no-underline hover:text-text hover:underline underline-offset-4"
const WIDE_LINK =
  "inline-flex min-h-8 items-center pointer-coarse:min-h-11 text-sm text-text-2 no-underline hover:text-text hover:underline underline-offset-4"

/** Legal titles too long for a footer row, shown by their usual short name (the full title stays the link's `title`). */
const SHORT: Readonly<Record<string, string>> = {
  "/yasal/kvkk-aydinlatma-metni": "footer.legal_short_privacy",
}

function LegalItems({
  links,
  t,
  className,
}: {
  links: readonly LinkView[]
  t: Translate
  className: string
}) {
  return (
    <>
      {links.map((link) => {
        const short = SHORT[link.path]
        return (
          <li key={link.path}>
            <a href={link.path} title={short ? link.label : undefined} className={className}>
              {short ? t(short) : link.label}
            </a>
          </li>
        )
      })}
      <li>
        <CookiePreferencesLink label={t("cookies.preferences")} className={className} />
      </li>
    </>
  )
}

/**
 * The legal texts and the cookie choices: on a phone and a tablet one
 * closed row like the footer's menu groups, first in the bottom zone so
 * it closes their list (52 px, 44 px links, two columns from 640 px);
 * from 1024 px four short columns, two rows for the usual seven texts
 * and the cookie choices. Only one is displayed.
 */
function Legal({ shop, t }: { shop: ShopView; t: Translate }) {
  const label = t("footer.legal")
  return (
    <>
      <details className="group/legal order-first border-b border-rule lg:hidden">
        <summary className="flex min-h-13 cursor-pointer items-center justify-between gap-4 font-semibold">
          {label}
          <Plus
            className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open/legal:rotate-45"
            aria-hidden="true"
            strokeWidth={1.75}
          />
        </summary>
        <nav aria-label={label} className="pb-3">
          <ul className="grid sm:grid-cols-2 sm:gap-x-(--gap-columns)">
            <LegalItems links={shop.legalLinks} t={t} className={PHONE_LINK} />
          </ul>
        </nav>
      </details>
      <nav aria-label={label} className="py-6 max-lg:hidden">
        <ul className="grid grid-cols-4 gap-x-(--gap-columns) gap-y-1">
          <LegalItems links={shop.legalLinks} t={t} className={WIDE_LINK} />
        </ul>
      </nav>
    </>
  )
}

/**
 * The footer's small print, on every page and in the checkout's frame
 * (sahip 2026-11-06: "bu kısmı hiç beğenmiyorum"): the legal texts (a
 * closed row on a phone, four short columns from 1024 px), then under a
 * rule one muted line with the year and the registered title and the
 * identity lines the law asks for (6563, ETBİS; only those filled in),
 * dots between them drawn by the stylesheet (a wrapped line starts
 * without one), and "Yukarı çık" at its end (an arrow alone on a phone).
 */
export function SmallPrint({ shop, t }: { shop: ShopView; t: Translate }) {
  const year = new Date().getFullYear()
  const title = shop.companyTitle ?? shop.name
  return (
    <>
      <Legal shop={shop} t={t} />
      <div className="flex items-start justify-between gap-4 pt-4 lg:items-center lg:border-t lg:border-rule lg:pt-5">
        <div className="min-w-0 overflow-hidden pt-3 lg:pt-0">
          <ul className="-ml-5 flex flex-wrap gap-y-1 text-xs text-text-3 *:relative *:pl-5 *:before:absolute *:before:top-1/2 *:before:left-2 *:before:size-[3px] *:before:-translate-y-1/2 *:before:rounded-full *:before:bg-current *:before:opacity-60 *:before:content-['']">
            <li>{t("footer.copyright", { year, name: title })}</li>
            {shop.identityLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <a
          href="#top"
          className="-mr-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-button px-3 text-xs font-semibold text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-8"
        >
          <span className="max-sm:sr-only">{t("footer.back_to_top")}</span>
          <ArrowUp className="size-4" aria-hidden="true" strokeWidth={2} />
        </a>
      </div>
    </>
  )
}
