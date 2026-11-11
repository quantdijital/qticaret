import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useMe } from "@/features/auth/api"
import type { TenantDetail } from "@/features/tenants/api"
import { canEditCompany } from "@/features/tenants/permissions"
import { CompanyDialog } from "./company-dialog"
import { TcknField } from "./tckn-field"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm wrap-break-word">{children ?? "—"}</dd>
    </div>
  )
}

/**
 * The shop's company (adr/0061 §2), the invoice's addressee: who it is on
 * paper beside where it is. A sole proprietor's TCKN masked, "Göster"
 * behind a step-up. Owner, operator and finance edit it in one dialog.
 */
export function CompanyCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const company = shop.company
  const sole = company?.kind === "sole_proprietor"
  const editable = canEditCompany(me?.role)
  const place = [company?.district, company?.city].filter(Boolean).join(" / ")
  return (
    <SectionCard
      title={t("company.title")}
      description={t("company.text")}
      action={
        editable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(true)
            }}
          >
            {t("company.edit")}
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <section aria-labelledby="company-invoice" className="flex flex-col gap-3">
          <h3 id="company-invoice" className="text-[13px] font-medium">
            {t("company.invoice")}
          </h3>
          <dl className="flex flex-col gap-3">
            <Fact label={t("company.kind")}>
              {t(`company.kinds.${company?.kind ?? "company"}`)}
            </Fact>
            <Fact label={t("company.legalName")}>{company?.legal_name}</Fact>
            <Fact label={t("company.taxOffice")}>{company?.tax_office}</Fact>
            {sole ? (
              <Fact label={t("company.tckn")}>
                {company.tckn_masked ? (
                  <TcknField
                    tenantId={shop.tenant.id}
                    masked={company.tckn_masked}
                    canReveal={editable}
                  />
                ) : null}
              </Fact>
            ) : (
              <Fact label={t("company.taxNumber")}>
                {company?.tax_number ? (
                  <span className="font-mono tabular-nums">{company.tax_number}</span>
                ) : null}
              </Fact>
            )}
          </dl>
        </section>
        <section aria-labelledby="company-address" className="flex flex-col gap-3">
          <h3 id="company-address" className="text-[13px] font-medium">
            {t("company.address")}
          </h3>
          <dl className="flex flex-col gap-3">
            <Fact label={t("company.addressLine")}>{company?.address_line}</Fact>
            <Fact label={t("company.place")}>{place || null}</Fact>
            <Fact label={t("company.postalCode")}>{company?.postal_code}</Fact>
            <Fact label={t("company.country")}>{t("company.turkey")}</Fact>
          </dl>
        </section>
      </div>
      {editable && editing ? (
        <CompanyDialog
          open={editing}
          onOpenChange={setEditing}
          tenantId={shop.tenant.id}
          company={company}
        />
      ) : null}
    </SectionCard>
  )
}
