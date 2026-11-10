import { DEFAULT_APPEARANCE } from "@qticaret/types"
import type { AppearanceSettings, ThemeMode } from "@qticaret/types"
import { resolveTheme } from "./engine"
import type { ResolvedMode, ResolvedTheme } from "./engine"

/**
 * Paints the document with a resolved theme and remembers the shop's
 * settings in this browser, so the next visit starts in the right colours
 * before the API answers (a convenience only; the API is the source).
 */

const STORAGE_KEY = "qt.panel.appearance"
const DARK_QUERY = "(prefers-color-scheme: dark)"

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode !== "system") {
    return mode
  }
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

export function paint(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value)
  }
  root.classList.toggle("dark", theme.mode === "dark")
  root.style.colorScheme = theme.mode
}

export function applyAppearance(settings: AppearanceSettings): ResolvedTheme {
  const theme = resolveTheme(settings, resolveMode(settings.mode))
  paint(theme)
  return theme
}

function rememberedAppearance(): AppearanceSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AppearanceSettings) : null
  } catch {
    // Storage blocked or unreadable: the defaults will do until the API answers
    return null
  }
}

export function rememberAppearance(settings: AppearanceSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage blocked: nothing to remember, the API answers on every visit
  }
}

/** First paint: the remembered settings or the defaults, and a listener for the system mode. */
export function bootTheme(): AppearanceSettings {
  const settings = rememberedAppearance() ?? DEFAULT_APPEARANCE
  applyAppearance(settings)
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    const current = rememberedAppearance() ?? DEFAULT_APPEARANCE
    if (current.mode === "system") {
      applyAppearance(current)
    }
  })
  return settings
}
