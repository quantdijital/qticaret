import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { t } from "@/lib/i18n"
import { shopView } from "@/lib/views/shop"
import { theme } from "@/theme"
import { inter } from "./fonts"
import "./globals.css"

// Every page is made per request: prices, stock and the cart are live (adr/0046 §2)
export const dynamic = "force-dynamic"

// Each page sets its own title and robots from the backend's seo object
export const metadata: Metadata = { formatDetection: { telephone: false } }

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const shop = await shopView()
  return (
    <html lang="tr" className={inter.variable}>
      <body>
        <theme.Layout shop={shop} t={t}>
          {children}
        </theme.Layout>
      </body>
    </html>
  )
}
