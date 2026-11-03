import type { Translate } from "@qticaret/ui"
import type { AddonWords } from "./AddonFields"

/** The backend's refusals of a line's add-on picks (adr/0052), shown in words. */
export const ADDON_ERRORS = [
  "addons.unknown",
  "addons.duplicate",
  "addons.text_required",
  "addons.text_too_long",
  "addons.charset",
  "addons.text_link",
  "addons.max_quantity",
  "addons.not_addon_line",
  "addons.required",
  "addons.unavailable",
  "addons.too_many",
  "cart.line_unknown",
  "catalog.addons_disabled",
]

export const addonWords = (t: Translate): AddonWords => ({
  title: t("addons.title"),
  perUnit: t("addons.per_unit"),
  required: t("addons.required_mark"),
  none: t("addons.none"),
  nonWithdrawable: t("addons.non_withdrawable"),
})
