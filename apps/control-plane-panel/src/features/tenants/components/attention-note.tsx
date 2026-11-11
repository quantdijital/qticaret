import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import type { TenantDetail } from "@/features/tenants/api"
import { gapsOf } from "@/features/tenants/gaps"

/**
 * What needs attention on the shop (docs/06: only while there is
 * something): the company's missing invoice fields, no billing contact
 * for the payment reminders, no package. A warning, never a block: the
 * record is saved as it is (the owner's rule).
 */
export function AttentionNote({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const { gaps, companyFields } = gapsOf(shop)
  if (gaps.length === 0) {
    return null
  }
  return (
    <Alert>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t("tenants.attention.title")}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {gaps.map((gap) => (
            <li key={gap}>
              {gap === "company"
                ? t("tenants.attention.company", {
                    fields: companyFields.map((field) => t(`company.${field}`)).join(", "),
                  })
                : t(`tenants.attention.${gap}`)}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
