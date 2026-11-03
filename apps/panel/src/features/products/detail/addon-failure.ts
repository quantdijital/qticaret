import type { TFunction } from "i18next"
import { errorText } from "@/lib/errors"

const E = "products.addons.errors"

// The server's refusals this card words itself; any other is said as the server says it
const REFUSALS: Readonly<Record<string, string>> = {
  "catalog.addons_disabled": "disabled",
  "addons.required_must_be_free": "requiredFree",
  "addons.too_many": "tooMany",
  "addons.label_invalid": "label",
  "addons.help_invalid": "help",
  "addons.price_invalid": "price",
  "addons.choices_invalid": "choices",
  "addons.id_duplicate": "idDuplicate",
  "addons.max_quantity_invalid": "maxQuantity",
  "addons.text_rules_invalid": "maxLength",
}

export interface AddonsFailure {
  text: string
  /** The shop's add-ons are off: the text links to Settings > Features. */
  features: boolean
}

function refusalOf(failure: unknown): string | null {
  const { code, message } = (failure ?? {}) as { code?: unknown; message?: unknown }
  for (const key of [code, message]) {
    if (typeof key === "string" && key in REFUSALS) {
      return key
    }
  }
  return null
}

/**
 * A refused save in words. The session client keeps only the server's
 * sentence; with the shop's flag off here, a refusal is the flag's.
 */
export function addonsFailureOf(t: TFunction, failure: unknown, flagOn: boolean): AddonsFailure {
  const key = refusalOf(failure)
  const status = (failure as { status?: unknown } | null)?.status
  const disabled = key === "catalog.addons_disabled" || (!flagOn && status === 400)
  if (disabled) {
    return { text: t(`${E}.disabled`), features: true }
  }
  return { text: key ? t(`${E}.${REFUSALS[key] ?? ""}`) : errorText(t, failure), features: false }
}
