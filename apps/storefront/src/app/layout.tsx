import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import type { ReactNode } from "react"
import { AnalyticsScripts } from "@/app/AnalyticsScripts"
import { saveCookieChoice } from "@/app/actions/cookies"
import { analyticsTags } from "@/lib/analytics/tags"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { shopView } from "@/lib/views/shop"
import { themeFonts, themeStyle } from "@/lib/views/theme"
import { currentTheme } from "@/lib/views/theme-settings"
import { theme } from "@/theme"
import { FONT_CLASSES } from "./fonts"
import "./globals.css"

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
  // The shop's theme settings over the theme's own (adr/0053 §B): one style
  // element with this response's nonce, so the CSP needs no 'unsafe-inline';
  // <html> carries the chosen faces' classes, which define their variables
  const style = themeStyle(settings)
  const fonts = themeFonts(settings).map((font) => FONT_CLASSES[font])
  const nonce = requestHeaders.get("x-nonce") ?? undefined
  // A design preview in the panel's frame is the shop's own look, not a visit
  const preview = (requestHeaders.get("x-qt-url") ?? "").startsWith("/onizleme/")
  return (
    <html lang="tr" className={fonts.join(" ")}>
      {/* Browser extensions write attributes on <body> before React loads */}
      <body suppressHydrationWarning>
        {style && <style nonce={nonce}>{style}</style>}
        {/* Before the page: its page view goes first, the page's own events after */}
        <AnalyticsScripts
          ga4={preview ? null : tags.ga4}
          meta={preview ? null : tags.meta}
          adSignals={tags.adSignals}
          nonce={nonce}
        />
        <theme.Layout
          shop={shop}
          t={t}
          saveCookies={saveCookieChoice}
          subscribe={subscribeNewsletter}
        >
          {children}
        </theme.Layout>
      </body>
    </html>
  )
}
