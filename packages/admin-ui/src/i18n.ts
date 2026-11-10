import en from "./locales/en.json" with { type: "json" }
import tr from "./locales/tr.json" with { type: "json" }

/**
 * The words the package's own components say (a dialog's "Kapat", a list's
 * page line), in their own i18next namespace. The package holds no i18next
 * instance: the app adds these to its own (adr/0061 §1.4), e.g.
 * `resources: { tr: { translation: tr, [ADMIN_UI_NS]: adminUiResources.tr } }`.
 */
export const ADMIN_UI_NS = "admin-ui"

export const adminUiResources = { tr, en } as const
