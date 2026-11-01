import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import type { ShopView } from "@qticaret/ui"
import { cartQuantity } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import { allCategories, pathsOf, siteSeo } from "@/lib/store-api/requests"
import { navigation } from "@/lib/views/categories"
import { theme } from "@/theme"
import { inter } from "./fonts"
import "./globals.css"

// Every page is made per request: prices, stock and the cart are live (adr/0046 §2)
export const dynamic = "force-dynamic"

// Each page sets its own title and robots from the backend's seo object
export const metadata: Metadata = { formatDetection: { telephone: false } }

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

async function shopView(): Promise<ShopView> {
  const [site, categories, quantity] = await Promise.all([
    siteSeo(),
    allCategories(),
    cartQuantity(),
  ])
  const paths = await pathsOf(
    "product_category",
    categories.map((category) => category.id)
  )
  return {
    name: site.shop.name,
    logo: site.shop.logo_url
      ? {
          src: site.shop.logo_url,
          alt: site.shop.name,
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
      : null,
    categories: navigation(categories, paths),
    // Legal pages get their storefront addresses with the content pages (D10)
    legal: [],
    cartQuantity: quantity,
  }
}

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
