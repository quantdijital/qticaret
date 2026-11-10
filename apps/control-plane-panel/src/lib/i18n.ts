import { ADMIN_UI_NS, adminUiResources } from "@qticaret/admin-ui/i18n"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../locales/en.json" with { type: "json" }
import tr from "../locales/tr.json" with { type: "json" }

/** Said on the console while developing; e2e's guard fails a page that says it. */
export const MISSING_KEY = "i18n missing key:"

/**
 * Turkish first, English for the platform team (the shop panel's setup).
 * The shared components' own words are their namespace (`admin-ui`,
 * adr/0061 Ek C5), added to this instance.
 */
void i18next.use(initReactI18next).init({
  resources: {
    tr: { translation: tr, [ADMIN_UI_NS]: adminUiResources.tr },
    en: { translation: en, [ADMIN_UI_NS]: adminUiResources.en },
  },
  ns: ["translation", ADMIN_UI_NS],
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
