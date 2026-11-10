import { CircleAlert } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSaveSection } from "@/features/settings/api/sections"
import type { LegalSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const K = "settings.store.legal"

// The address is written with the contact details, the social accounts on their own tab
type Values = Record<
  "company_title" | "mersis" | "tax_office" | "tax_number" | "kep" | "etbis",
  string
>

const valuesOf = (saved: LegalSettings): Values => ({
  company_title: saved.company_title ?? "",
  mersis: saved.mersis ?? "",
  tax_office: saved.tax_office ?? "",
  tax_number: saved.tax_number ?? "",
  kep: saved.kep ?? "",
  etbis: saved.etbis ?? "",
})

// The server's rule (lib/legal/identity.ts): MERSİS, KEP and ETBİS are asked, not required
const REQUIRED = ["company_title", "address", "tax_office", "tax_number"] as const

/** What the identity still lacks; the address and a way to reach the shop are the contact tab's. */
function identityGaps(saved: LegalSettings, hasContact: boolean): string[] {
  return [...REQUIRED.filter((field) => !saved[field]?.trim()), ...(hasContact ? [] : ["contact"])]
}

/**
 * The shop's legal identity (F13.9, adr/0041 §3): what the law asks a web
 * shop to show; its footer, structured data and legal texts read it. What
 * is still required is said at the top, the contact tab's gaps included.
 */
export function LegalIdentityCard({
  saved,
  hasContact,
  className,
}: {
  saved: LegalSettings
  hasContact: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const save = useSaveSection<LegalSettings>("legal")
  const initial = valuesOf(saved)
  const form = useForm<Values>({ values: initial, resetOptions: { keepDirtyValues: true } })
  const gaps = identityGaps(saved, hasContact)
  const submit = form.handleSubmit((next) => {
    save.mutate(next, {
      onSuccess: (result) => {
        form.reset(valuesOf(result.values), FULL_RESET)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  const field = (name: keyof Values, props: { required?: boolean; hint?: string } = {}) => ({
    label: t(`${K}.fields.${name}`),
    htmlFor: `legal-${name}`,
    ...(props.required ? { required: true } : {}),
    ...(props.hint ? { hint: props.hint } : {}),
  })
  return (
    <CardForm
      title={t(`${K}.title`)}
      description={t(`${K}.hint`)}
      className={className}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(initial, FULL_RESET)
      }}
    >
      {gaps.length > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`${K}.missing`, {
            fields: gaps.map((gap) => t(`${K}.gaps.${gap}`)).join(", "),
          })}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field {...field("company_title", { required: true })}>
          <Input id="legal-company_title" maxLength={200} {...form.register("company_title")} />
        </Field>
        <Field {...field("mersis", { hint: t(`${K}.mersisHint`) })}>
          <Input id="legal-mersis" inputMode="numeric" {...form.register("mersis")} />
        </Field>
        <Field {...field("tax_office", { required: true })}>
          <Input id="legal-tax_office" maxLength={100} {...form.register("tax_office")} />
        </Field>
        <Field {...field("tax_number", { required: true, hint: t(`${K}.taxNumberHint`) })}>
          <Input id="legal-tax_number" inputMode="numeric" {...form.register("tax_number")} />
        </Field>
        <Field {...field("kep")}>
          <Input id="legal-kep" type="email" autoComplete="off" {...form.register("kep")} />
        </Field>
        <Field {...field("etbis", { hint: t(`${K}.etbisHint`) })}>
          <Input id="legal-etbis" {...form.register("etbis")} />
        </Field>
      </div>
    </CardForm>
  )
}
