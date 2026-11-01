import { useQuery } from "@tanstack/react-query"
import { CircleAlert } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { LegalSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const K = "settings.store.legal"

interface Values {
  company_title: string
  tax_office: string
  tax_number: string
  address: string
  mersis: string
  kep: string
  etbis: string
  same_as: string
}

const valuesOf = (saved: LegalSettings): Values => ({
  company_title: saved.company_title ?? "",
  tax_office: saved.tax_office ?? "",
  tax_number: saved.tax_number ?? "",
  address: saved.address ?? "",
  mersis: saved.mersis ?? "",
  kep: saved.kep ?? "",
  etbis: saved.etbis ?? "",
  same_as: saved.same_as.join("\n"),
})

// The server's rule (lib/legal/identity.ts): MERSİS, KEP and ETBİS are asked, not required
const REQUIRED = ["company_title", "address", "tax_office", "tax_number"] as const

/** What the identity still lacks, a way to reach the shop included (the contact card's). */
function identityGaps(saved: LegalSettings, hasContact: boolean): string[] {
  return [...REQUIRED.filter((field) => !saved[field]?.trim()), ...(hasContact ? [] : ["contact"])]
}

function Form({ saved, hasContact }: { saved: LegalSettings; hasContact: boolean }) {
  const { t } = useTranslation()
  const save = useSaveSection<LegalSettings>("legal")
  const initial = valuesOf(saved)
  const form = useForm<Values>({ values: initial, resetOptions: { keepDirtyValues: true } })
  const gaps = identityGaps(saved, hasContact)
  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        ...next,
        same_as: next.same_as
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
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
      <Field {...field("company_title", { required: true })}>
        <Input id="legal-company_title" maxLength={200} {...form.register("company_title")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field {...field("tax_office", { required: true })}>
          <Input id="legal-tax_office" maxLength={100} {...form.register("tax_office")} />
        </Field>
        <Field {...field("tax_number", { required: true, hint: t(`${K}.taxNumberHint`) })}>
          <Input id="legal-tax_number" inputMode="numeric" {...form.register("tax_number")} />
        </Field>
      </div>
      <Field {...field("address", { required: true })}>
        <Textarea id="legal-address" maxLength={500} rows={2} {...form.register("address")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field {...field("mersis", { hint: t(`${K}.mersisHint`) })}>
          <Input id="legal-mersis" inputMode="numeric" {...form.register("mersis")} />
        </Field>
        <Field {...field("kep")}>
          <Input id="legal-kep" type="email" autoComplete="off" {...form.register("kep")} />
        </Field>
      </div>
      <Field {...field("etbis", { hint: t(`${K}.etbisHint`) })}>
        <Input id="legal-etbis" {...form.register("etbis")} />
      </Field>
      <Field {...field("same_as", { hint: t(`${K}.sameAsHint`) })}>
        <Textarea
          id="legal-same_as"
          rows={3}
          placeholder="https://instagram.com/magazaniz"
          {...form.register("same_as")}
        />
      </Field>
    </CardForm>
  )
}

/**
 * The shop's legal identity (F13.9, adr/0041 §3): what the law asks a web
 * shop to show; its footer, structured data and legal texts read it. What
 * is still required is said at the top.
 */
export function LegalIdentityCard({ hasContact }: { hasContact: boolean }) {
  const query = useQuery(sectionQuery<LegalSettings>("legal"))
  return query.data ? (
    <Form saved={query.data.values} hasContact={hasContact} />
  ) : (
    <Skeleton className="h-96 rounded-lg" />
  )
}
