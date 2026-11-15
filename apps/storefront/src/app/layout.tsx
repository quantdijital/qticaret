import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import type { ReactNode } from "react"
import { AnalyticsScripts } from "@/app/AnalyticsScripts"
import { addToCart, changeCartLine } from "@/app/actions/cart"
import { saveCookieChoice } from "@/app/actions/cookies"
import { NO_CART } from "@/lib/analytics/cart-changes"
import { cartSnapshotOf } from "@/lib/analytics/cart-payloads"
import { analyticsTags } from "@/lib/analytics/tags"
import { headerCart } from "@/lib/cart/cart"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { QUICK_VIEW_PATH } from "@/lib/views/quick-view"
import { SUGGEST_PATH } from "@/lib/views/search-suggest"
import { shopView } from "@/lib/views/shop"
import { currentTheme } from "@/lib/views/theme-settings"
import { theme, themeFontPreloads, themeSettingsStyle } from "@/theme"
// The chosen theme's stylesheet (adr/0057; `next.config.ts` resolves it)
import "@qticaret/storefront-theme-styles"

// Every page is made per request: prices, stock and the cart are live (adr/0046 §2)
export const dynamic = "force-dynamic"

// Each page sets its own title and robots from the backend's seo object
export const metadata: Metadata = { formatDetection: { telephone: false } }

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [shop, settings, requestHeaders, tags] = await Promise.all([
    shopView(),
    currentTheme(),
    headers(),
    analyticsTags(),
  ])
  // The shop's theme settings over the theme's own (adr/0053 §B), those the
  // theme takes: one style element with this response's nonce, so the CSP
  // needs no 'unsafe-inline'
  const style = themeSettingsStyle(settings)
  const nonce = requestHeaders.get("x-nonce") ?? undefined
  // A design preview in the panel's frame is the shop's own look, not a visit
  const preview = (requestHeaders.get("x-qt-url") ?? "").startsWith("/onizleme/")
  const measured = !preview && (tags.ga4 !== null || tags.meta !== null)
  // The cart the header shows (asked once per render), for its "added" and "taken out": only to a
  // browser whose visitor allowed a tag
  const cart = measured ? cartSnapshotOf(await headerCart()) : NO_CART
  return (
    <html lang="tr">
      {/* Browser extensions write attributes on <body> before React loads */}
      <body suppressHydrationWarning>
        {/* The faces the page draws in only (`app/fonts.ts`); React puts these in <head> */}
        {themeFontPreloads(settings).map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        {style && <style nonce={nonce}>{style}</style>}
        {/* Before the page: its page view goes first, the page's own events after */}
        <AnalyticsScripts
          ga4={preview ? null : tags.ga4}
          meta={preview ? null : tags.meta}
          adSignals={tags.adSignals}
          nonce={nonce}
          cart={cart}
        />
        <theme.Layout
          shop={shop}
          t={t}
          saveCookies={saveCookieChoice}
          subscribe={subscribeNewsletter}
          searchSuggest={SUGGEST_PATH}
          changeCartLine={changeCartLine}
          // The cards' quick view dialog (adr/0049 Ek 2026-11-15): only while the shop has it on
          {...(settings.product_card.quick_view
            ? { quickView: { address: QUICK_VIEW_PATH, addToCart } }
            : {})}
        >
          {children}
        </theme.Layout>
      </body>
    </html>
  )
}
