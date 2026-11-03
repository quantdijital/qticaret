import { useTranslation } from "react-i18next"
import type { ExtraToken } from "@/features/settings/components/shop-token-menu"

/** `{ad}` beside the shop's details in every token menu of a campaign (adr/0050 §4). */
export function useNameToken(): ExtraToken[] {
  const { t } = useTranslation()
  return [
    { name: "ad", label: t("bulkMessages.tokens.name"), hint: t("bulkMessages.tokens.nameHint") },
  ]
}
