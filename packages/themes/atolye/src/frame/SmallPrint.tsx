import type { ShopView, Translate } from "@qticaret/ui"
import { CookiePreferencesLink } from "./CookiePreferencesLink"

const SMALL_LINK =
  "inline-flex min-h-11 items-center whitespace-nowrap text-text-2 no-underline hover:text-text hover:underline underline-offset-4 lg:pointer-fine:min-h-8"

/**
 * The footer's small print, on every page and in the checkout's frame:
 * the legal texts in one wrapping line with the cookie choices, each
 * identity line (6563, ETBİS), and the year with the registered title on
 * its own line under a rule.
 */
export function SmallPrint({ shop, t }: { shop: ShopView; t: Translate }) {
  const year = new Date().getFullYear()
  const title = shop.companyTitle ?? shop.name
  return (
    <>
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
    </>
  )
}
