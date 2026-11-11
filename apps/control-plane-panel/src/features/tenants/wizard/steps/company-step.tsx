import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { CompanyKind } from "@/features/tenants/api"
import type { CompanyDraft } from "../draft"
import { TextField } from "../field"
import type { StepProps } from "../field"

const KINDS: readonly CompanyKind[] = ["company", "sole_proprietor"]

const LABELS: Record<Exclude<keyof CompanyDraft, "kind">, string> = {
  legal_name: "company.legalName",
  tax_office: "company.taxOffice",
  tax_number: "company.taxNumber",
  tckn: "company.tckn",
  address_line: "company.addressLine",
  district: "company.district",
  city: "company.city",
  postal_code: "company.postalCode",
}

const NUMERIC = new Set(["tax_number", "tckn", "postal_code"])

/**
 * Step 1, the shop and its company (C7's fields and checks): the name
 * staff know it by, then the invoice's addressee and address. Only the
 * name is required; a blank invoice field is said on the review and on
 * the shop's page, never refused. A sole proprietor's TCKN is sent once,
 * with the company, and never shown again.
 */
export function CompanyStep({ draft, change, problems }: StepProps) {
  const { t } = useTranslation()
  const { company } = draft
  const sole = company.kind === "sole_proprietor"
  const set = (key: keyof CompanyDraft, value: string) => {
    change((current) => ({ ...current, company: { ...current.company, [key]: value } }))
  }
  const field = (key: Exclude<keyof CompanyDraft, "kind">, help?: string) => (
    <TextField
      id={`wizard-company-${key}`}
      label={t(LABELS[key])}
      value={company[key]}
      onChange={(value) => {
        set(key, value)
      }}
      problem={problems[`company.${key}`]}
      help={help}
      inputMode={NUMERIC.has(key) ? "numeric" : undefined}
    />
  )
  return (
    <>
      <SectionCard title={t("wizard.company.shopTitle")} description={t("wizard.company.shopText")}>
        <TextField
          id="wizard-name"
          label={t("tenants.create.name")}
          value={draft.name}
          maxLength={100}
          onChange={(value) => {
            change((current) => ({ ...current, name: value }))
          }}
          problem={problems["name"]}
        />
      </SectionCard>
      <SectionCard title={t("company.invoice")} description={t("wizard.company.invoiceText")}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p id="wizard-kind-label" className="text-sm font-medium">
              {t("company.kind")}
            </p>
            <RadioGroup
              aria-labelledby="wizard-kind-label"
              value={company.kind}
              onValueChange={(next) => {
                set("kind", next)
              }}
              className="flex flex-wrap gap-6"
            >
              {KINDS.map((kind) => (
                <div key={kind} className="flex items-center gap-2">
                  <RadioGroupItem id={`wizard-kind-${kind}`} value={kind} />
                  <Label htmlFor={`wizard-kind-${kind}`} className="font-normal">
                    {t(`company.kinds.${kind}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("legal_name")}</div>
            {field("tax_office")}
            {sole ? field("tckn", t("wizard.company.tcknHelp")) : field("tax_number")}
          </div>
        </div>
      </SectionCard>
      <SectionCard title={t("company.address")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">{field("address_line")}</div>
          {field("district")}
          {field("city")}
          {field("postal_code")}
        </div>
      </SectionCard>
    </>
  )
}
