import { SERVER_ERROR_MESSAGES_EN } from "../../lib/errors/messages/en"
import { SERVER_ERROR_MESSAGES_TR } from "../../lib/errors/messages/tr"
import coreTr from "./core-overrides/tr.json" with { type: "json" }
import en from "./en.json" with { type: "json" }
import tr from "./tr.json" with { type: "json" }

interface Tree {
  [key: string]: string | Tree
}

// `catalog.handle_invalid` → { catalog: { handle_invalid } }, as i18next reads keys
function nest(flat: Readonly<Record<string, string>>): Tree {
  const root: Tree = {}
  for (const [key, text] of Object.entries(flat)) {
    const parts = key.split(".")
    const leaf = parts.pop() ?? key
    let node = root
    for (const part of parts) {
      const next = node[part]
      node = typeof next === "object" ? next : (node[part] = {})
    }
    node[leaf] = text
  }
  return root
}

/**
 * Admin customization strings (docs/06). Merged into the dashboard's default
 * namespace; every key of ours lives under `qticaret.` so it cannot shadow
 * Medusa's own keys. Turkish is the default (DEFAULT_LOCALE in packages/types).
 * The API's error texts come from `lib/errors/messages`, which the server
 * also answers the dashboard with, under `qticaret.serverErrors.<key>`.
 *
 * `core-overrides/tr.json` is the one exception (adr/0021): Turkish texts of
 * core screens rewritten in our glossary (Fulfillment → Gönderi, Inventory →
 * Stok, Handle → URL adresi...). The dashboard merges these over its own
 * translation key by key; English core texts are left alone. On a Medusa
 * upgrade, `scripts/check-core-overrides.mjs` checks that every key still
 * exists with the same placeholders.
 */
export default {
  tr: {
    translation: {
      ...coreTr,
      qticaret: { ...tr.qticaret, serverErrors: nest(SERVER_ERROR_MESSAGES_TR) },
    },
  },
  en: {
    translation: { qticaret: { ...en.qticaret, serverErrors: nest(SERVER_ERROR_MESSAGES_EN) } },
  },
}
