import en from "./en.json" with { type: "json" }
import tr from "./tr.json" with { type: "json" }

/**
 * Admin customization strings (docs/06). Merged into the dashboard's default
 * namespace; every key lives under `qticaret.` so it cannot shadow Medusa's
 * own keys. Turkish is the default (DEFAULT_LOCALE in packages/types).
 */
export default {
  tr: { translation: tr },
  en: { translation: en },
}
