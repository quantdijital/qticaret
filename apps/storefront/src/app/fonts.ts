import { Inter } from "next/font/google"

/**
 * The storefront's typefaces (docs/19 §3). next/font downloads them at build
 * time and serves them from this origin: no request reaches Google from a
 * shopper's browser (KVKK) and the CSP stays `font-src 'self'`. A theme reads
 * them through its `--font-sans` and `--font-heading` tokens.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
})
