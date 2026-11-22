import type { Translate } from "@qticaret/ui"
import type { TravelersWords } from "./TravelersForm"

/** The travelers step's words (adr/0076 Ek D6b), from the storefront's messages. */
export const travelerWords = (t: Translate, errors: Record<string, string>): TravelersWords => ({
  person: (n) => t("checkout.traveler_n", { n: String(n) }),
  firstName: t("checkout.first_name"),
  lastName: t("checkout.last_name"),
  birthDate: t("checkout.traveler_birth_date"),
  document: t("checkout.traveler_document"),
  documentHint: t("checkout.traveler_document_hint"),
  documentSaved: (masked) => t("checkout.traveler_document_saved", { masked }),
  nationality: t("checkout.traveler_nationality"),
  choose: t("checkout.traveler_choose"),
  note: t("checkout.travelers_note"),
  submit: t("checkout.to_payment"),
  saving: t("checkout.saving"),
  errors,
  fallback: t("checkout.travelers_failed"),
})
