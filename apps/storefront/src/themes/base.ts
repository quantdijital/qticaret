import { baseTheme } from "@qticaret/theme-base"
import { fontPreloads } from "@/app/fonts"
import { themeStyle } from "@/lib/views/theme"
import type { ThemeEntry } from "./entry"

/** The first theme (adr/0046 §7): every theme setting the shop makes applies. */
export const entry: ThemeEntry = { theme: baseTheme, fontPreloads, style: themeStyle }
