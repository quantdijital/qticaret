import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import type { ReactNode } from "react"
import { t } from "@/lib/i18n"
import { storefrontSettings } from "@/lib/store-api/requests"
import { brandStyle } from "@/lib/views/color"
import { shopView } from "@/lib/views/shop"
import { theme } from "@/theme"
import { fraunces, inter } from "./fonts"
import "./globals.css"

// Every page is made per request: prices, stock and the cart are live (adr/0046 §2)
export const dynamic = "force-dynamic"

// Each page sets its own title and robots from the backend's seo object
export const metadata: Metadata = { formatDetection: { telephone: false } }

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [shop, { storefront }, requestHeaders] = await Promise.all([
    shopView(),
    storefrontSettings(),
    headers(),
  ])
  // The shop's colour over the theme's (D3): one style element with this
  // response's nonce, so the CSP needs no 'unsafe-inline'
  const brand = brandStyle(storefront.primary_color)
  const nonce = requestHeaders.get("x-nonce") ?? undefined
  return (
    <html lang="tr" className={`${inter.variable} ${fraunces.variable}`}>
      {/* Browser extensions write attributes on <body> before React loads */}
      <body suppressHydrationWarning>
        {brand && <style nonce={nonce}>{brand}</style>}
        <theme.Layout shop={shop} t={t}>
          {children}
        </theme.Layout>
      </body>
    </html>
  )
}
