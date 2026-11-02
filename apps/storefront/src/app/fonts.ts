import {
  DM_Serif_Display,
  Fraunces,
  Inter,
  Manrope,
  Nunito,
  Playfair_Display,
  Source_Sans_3,
} from "next/font/google"
import type { ThemeFont } from "@/lib/views/theme"

/**
 * The faces a shop may choose (docs/19 §3, adr/0053 §B). next/font downloads
 * them at build time and serves them from this origin: no request reaches
 * Google from a shopper's browser (KVKK) and the CSP stays `font-src 'self'`.
 * Each sets its own CSS variable; `<html>` carries only the chosen faces'
 * classes and the theme reads them through `--font-heading` and
 * `--font-sans` (`lib/views/theme.ts`). Only today's two (Fraunces over
 * Inter) are preloaded: a preload is fixed at build time for every page, and
 * a face the shop did not choose must cost its visitors nothing.
 */
// next/font reads its options at build time: each call spells them out as literals
const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" })

/** The base theme's display face: a soft serif with an optical size axis. */
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  axes: ["opsz", "SOFT"],
  variable: "--font-fraunces",
})

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-playfair",
  preload: false,
})

// One weight only: the face has no others
const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  variable: "--font-dm-serif",
  preload: false,
})

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-manrope",
  preload: false,
})

const sourceSans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-source-sans",
  preload: false,
})

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-nunito",
  preload: false,
})

/** Each face's class, which defines its CSS variable (`THEME_FONTS`). */
export const FONT_CLASSES: Readonly<Record<ThemeFont, string>> = {
  inter: inter.variable,
  fraunces: fraunces.variable,
  playfair: playfair.variable,
  "dm-serif": dmSerif.variable,
  manrope: manrope.variable,
  "source-sans": sourceSans.variable,
  nunito: nunito.variable,
}
