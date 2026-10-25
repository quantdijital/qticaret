import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../locales/en.json" with { type: "json" }
import tr from "../locales/tr.json" with { type: "json" }

/** Turkish first (DEFAULT_LOCALE in packages/types); English for the platform team. */
void i18next.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: "tr",
  fallbackLng: "tr",
  interpolation: { escapeValue: false },
})

export { i18next }
