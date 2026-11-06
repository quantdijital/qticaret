import type { Translate } from "@qticaret/ui"
import type { MessageKey } from "."

/**
 * The words of the error pages (`app/error.tsx`, `app/global-error.tsx`).
 * Those are client components that every page loads, so whatever they
 * import ships in every page's script: the whole dictionary (`tr.json`)
 * is 64 KB, 19 KB gzipped (docs/21, 2026-11-06). The theme's error page
 * needs these four. A test keeps each equal to `tr.json` and checks the
 * themes' error pages ask for no other key.
 */
export const ERROR_MESSAGES = {
  "error.title": "Sayfa şu an açılamadı",
  "error.body": "Kısa bir aksaklık oldu. Birkaç saniye sonra yeniden deneyin.",
  "error.retry": "Tekrar dene",
  "error.home": "Ana sayfa",
} as const satisfies Partial<Record<MessageKey, string>>

const MESSAGES: Readonly<Record<string, string>> = ERROR_MESSAGES

/** The error pages' `t`: a key it does not hold shows the key, as the full one does. */
export const errorT: Translate = (key) => MESSAGES[key] ?? key
