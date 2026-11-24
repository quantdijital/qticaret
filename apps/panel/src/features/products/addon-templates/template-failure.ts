import type { TFunction } from "i18next"
import { addonsFailureOf } from "@/features/products/detail/addon-failure"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"

const T = "products.addonTemplates.errors"

// A template's own refusals in its words; the rest as the add-ons card says them
const REFUSALS: Readonly<Record<string, string>> = {
  "addon_templates.name_invalid": "name",
  "addon_templates.too_many": "tooMany",
  "addon_templates.id_unknown": "idUnknown",
}

/** A refused template save in words (adr/0052 Ek 2026-11-23). */
export function templateFailureOf(t: TFunction, error: unknown, flagOn: boolean): AddonsFailure {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  for (const key of [code, message]) {
    if (typeof key === "string" && key in REFUSALS) {
      return { text: t(`${T}.${REFUSALS[key] ?? ""}`), features: false }
    }
  }
  return addonsFailureOf(t, error, flagOn)
}
