import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../locales/en.json" with { type: "json" }
import tr from "../locales/tr.json" with { type: "json" }

/** Said on the console while developing; e2e's guard fails a page that says it. */
export const MISSING_KEY = "i18n missing key:"

/**
 * Turkish first (DEFAULT_LOCALE in packages/types); English for the platform
 * team. A key built at run time that the files lack would show as the key
 * itself: in development it is reported, unless the call gave its own
 * fallback (a provider or template the panel may not know yet).
 */
void i18next.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: "tr",
  fallbackLng: "tr",
  interpolation: { escapeValue: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (_languages, _namespace, key, _fallback, _update, options) => {
    if ((options as { defaultValue?: unknown } | undefined)?.defaultValue === undefined) {
      // eslint-disable-next-line no-console -- a developer's notice, never shipped (DEV only)
      console.warn(`${MISSING_KEY} ${key}`)
    }
  },
})

export { i18next }
