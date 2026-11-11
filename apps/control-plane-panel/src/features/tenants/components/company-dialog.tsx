import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { Company } from "@/features/tenants/api"
import { useSaveCompany } from "@/features/tenants/mutations"
import type { CompanyInput } from "@/features/tenants/mutations"
import { companyFieldWrong, compact, isCheckedField } from "@/features/tenants/company-rules"
import { errorText } from "@/lib/errors"

type Fields = Omit<CompanyInput, "tckn"> & { tckn: string }

const TEXT_FIELDS = ["legal_name", "tax_office", "address_line", "district", "city"] as const

const fieldsOf = (company: Company | null): Fields => ({
  kind: company?.kind ?? "company",
  legal_name: company?.legal_name ?? "",
  tax_office: company?.tax_office ?? "",
  tax_number: company?.tax_number ?? "",
  tckn: "",
  address_line: company?.address_line ?? "",
  district: company?.district ?? "",
  city: company?.city ?? "",
  postal_code: company?.postal_code ?? "",
})

const LABELS: Record<keyof Fields, string> = {
  kind: "company.kind",
  legal_name: "company.legalName",
  tax_office: "company.taxOffice",
  tax_number: "company.taxNumber",
  tckn: "company.tckn",
  address_line: "company.addressLine",
  district: "company.district",
  city: "company.city",
  postal_code: "company.postalCode",
}

/**
 * The shop's company in one form (owner, operator, finance): the invoice's
 * addressee and its address. Blank fields are kept blank (the page warns,
 * nothing refuses). A sole proprietor's TCKN is written, never read back:
 * left empty, the stored one stays; a company keeps none.
 */
export function CompanyDialog({
  open,
  onOpenChange,
  tenantId,
  company,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  company: Company | null
}) {
  const { t } = useTranslation()
  const save = useSaveCompany(tenantId)
  const [fields, setFields] = useState<Fields>(() => fieldsOf(company))
  const [failure, setFailure] = useState<string | null>(null)
  const initial = fieldsOf(company)
  const dirty = (Object.keys(fields) as (keyof Fields)[]).some(
    (key) => fields[key] !== initial[key]
  )
  const sole = fields.kind === "sole_proprietor"
  // The check digits too (company-rules.ts); the control plane checks again
  const wrong = (key: keyof Fields) => isCheckedField(key) && companyFieldWrong(key, fields[key])
  const invalid = (sole ? ["tckn", "postal_code"] : ["tax_number", "postal_code"]).some((key) =>
    wrong(key as keyof Fields)
  )
  const set = (key: keyof Fields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }))
  }
  const close = (next: boolean) => {
    if (!next) {
      setFields(fieldsOf(company))
      setFailure(null)
    }
    onOpenChange(next)
  }
  const field = (key: Exclude<keyof Fields, "kind">, extra: { placeholder?: string } = {}) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`company-${key}`}>{t(LABELS[key])}</Label>
      <Input
        id={`company-${key}`}
        autoComplete="off"
        inputMode={isCheckedField(key) ? "numeric" : undefined}
        aria-invalid={wrong(key)}
        value={fields[key]}
        onChange={(event) => {
          set(key, event.target.value)
        }}
        {...extra}
      />
      {wrong(key) ? (
        <p className="text-[13px] text-destructive">{t(`company.invalid.${key}`)}</p>
      ) : null}
    </div>
  )
  const submit = () => {
    setFailure(null)
    const { tckn, ...rest } = fields
    const input: CompanyInput = {
      ...rest,
      tax_number: sole ? "" : compact(rest.tax_number),
      ...(sole && tckn.trim() !== "" ? { tckn: compact(tckn) } : {}),
    }
    save.mutate(input, {
      onSuccess: () => {
        toast.success(t("company.saved"))
        onOpenChange(false)
      },
      onError: (error) => {
        setFailure(errorText(t, error))
      },
    })
  }
  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={t("company.title")}
      description={t("company.dialogText")}
      size="lg"
      pane
      dirty={dirty}
      saving={save.isPending}
      canSubmit={!invalid}
      onSubmit={submit}
    >
      <DialogBody>
        <DialogSection title={<span id="company-kind-label">{t("company.kind")}</span>}>
          <RadioGroup
            aria-labelledby="company-kind-label"
            value={fields.kind}
            onValueChange={(next) => {
              set("kind", next)
            }}
            className="flex flex-wrap gap-6"
          >
            {(["company", "sole_proprietor"] as const).map((kind) => (
              <div key={kind} className="flex items-center gap-2">
                <RadioGroupItem id={`company-kind-${kind}`} value={kind} />
                <Label htmlFor={`company-kind-${kind}`} className="font-normal">
                  {t(`company.kinds.${kind}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </DialogSection>
        <DialogSection title={t("company.invoice")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field(TEXT_FIELDS[0])}</div>
            {field("tax_office")}
            {sole
              ? field("tckn", {
                  placeholder: company?.tckn_masked
                    ? t("company.tcknKeep", { masked: company.tckn_masked })
                    : "",
                })
              : field("tax_number")}
          </div>
        </DialogSection>
        <DialogSection title={t("company.address")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">{field("address_line")}</div>
            {field("district")}
            {field("city")}
            {field("postal_code")}
          </div>
        </DialogSection>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
