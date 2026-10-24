import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { MaskedBillingProfile } from "../../modules/billing-profile/types"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? ""

async function fetchBillingProfile(customerId: string): Promise<MaskedBillingProfile | null> {
  const response = await fetch(
    `${BACKEND_URL}/admin/customers/${encodeURIComponent(customerId)}/billing-profile`,
    { credentials: "include" }
  )
  if (!response.ok) {
    throw new Error(`billing profile request failed with ${String(response.status)}`)
  }
  const body = (await response.json()) as { billing_profile: MaskedBillingProfile | null }
  return body.billing_profile
}

/**
 * Billing details on the customer page (F1.5, adr/0009). Only the masked tax
 * id reaches the browser; revealing it needs a permission (F12) and an
 * audit entry (F2.5).
 */
function CustomerBillingProfileWidget({ data: customer }: DetailWidgetProps<AdminCustomer>) {
  const { t } = useTranslation()
  const {
    data: profile,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["qticaret", "billing-profile", customer.id],
    queryFn: () => fetchBillingProfile(customer.id),
  })

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t("qticaret.billingProfile.title")}</Heading>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <div
            aria-busy="true"
            aria-label={t("qticaret.common.loading")}
            className="flex flex-col gap-2"
          >
            <div className="bg-ui-bg-component h-4 w-48 animate-pulse rounded" />
            <div className="bg-ui-bg-component h-4 w-32 animate-pulse rounded" />
          </div>
        ) : isError ? (
          <Text size="small" className="text-ui-fg-error">
            {t("qticaret.billingProfile.error")}
          </Text>
        ) : !profile ? (
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.billingProfile.empty")}
          </Text>
        ) : (
          <ProfileDetails profile={profile} />
        )}
      </div>
    </Container>
  )
}

function ProfileDetails({ profile }: { profile: MaskedBillingProfile }) {
  const { t } = useTranslation()
  const rows: [string, string][] = [
    [t("qticaret.billingProfile.type"), t(`qticaret.billingProfile.types.${profile.type}`)],
    [t("qticaret.billingProfile.legalName"), profile.legal_name],
    ...(profile.tax_office
      ? [[t("qticaret.billingProfile.taxOffice"), profile.tax_office] as [string, string]]
      : []),
    [t(`qticaret.billingProfile.taxId.${profile.type}`), profile.tax_id_masked],
  ]

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>
              <Text size="small" weight="plus" className="text-ui-fg-subtle">
                {label}
              </Text>
            </dt>
            <dd>
              <Text size="small">{value}</Text>
            </dd>
          </div>
        ))}
      </dl>
      <Text size="xsmall" className="text-ui-fg-muted">
        {t("qticaret.billingProfile.maskedHint")}
      </Text>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.after",
})

export default CustomerBillingProfileWidget
