import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RETURN_CODE_PATTERN, sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { ContractedReturnCodes, ReturnsSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const C = "settings.shipping.returnCode"

const code = z
  .string()
  .trim()
  .max(40, `${C}.invalid`)
  .refine((value) => value === "" || RETURN_CODE_PATTERN.test(value), `${C}.invalid`)

const base = z.object({ carrier: z.string().trim().max(60), code })
type Values = z.infer<typeof base>

/** Which code the card edits: one of our carriers', or BirFatura's carrier with its name. */
type Target = "aras" | "yurtici" | "dhlecommerce" | "surat" | "ptt" | "other"

// Our carrier is named by the page; BirFatura's is named with its code, both or neither
const schemaOf = (target: Target) =>
  target === "other"
    ? base.refine((value) => (value.carrier === "") === (value.code === ""), {
        message: `${C}.both`,
        path: ["carrier"],
      })
    : base

const EMPTY: ContractedReturnCodes = {
  aras: null,
  yurtici: null,
  dhlecommerce: null,
  surat: null,
  ptt: null,
  other_carrier: null,
  other_code: null,
}

const valuesOf = (saved: ContractedReturnCodes, target: Target): Values =>
  target === "other"
    ? { carrier: saved.other_carrier ?? "", code: saved.other_code ?? "" }
    : { carrier: "", code: saved[target] ?? "" }

const orNull = (text: string) => (text === "" ? null : text)

function CodeForm({ saved, target }: { saved: ContractedReturnCodes; target: Target }) {
  const { t } = useTranslation()
  const save = useSaveSection<ReturnsSettings>("returns")
  const values = valuesOf(saved, target)
  const form = useForm<Values>({
    resolver: zodResolver(schemaOf(target)),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    const settle = beginSave(form)
    // One field of the section's map: the server keeps the others as stored
    const patch =
      target === "other"
        ? { other_carrier: orNull(next.carrier), other_code: orNull(next.code) }
        : { [target]: orNull(next.code) }
    save.mutate(
      { contracted_return: patch as unknown as ContractedReturnCodes },
      {
        onSuccess: (result) => {
          settle(valuesOf(result.values.contracted_return ?? EMPTY, target))
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const codeField = (
    <Field
      label={t(`${C}.label`)}
      htmlFor={`return-code-${target}`}
      hint={t(`${C}.hint`)}
      error={errors.code?.message ? t(errors.code.message) : undefined}
    >
      <Input
        id={`return-code-${target}`}
        maxLength={40}
        autoComplete="off"
        placeholder={t(`${C}.placeholder`)}
        {...form.register("code")}
      />
    </Field>
  )
  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(target === "other" ? `${C}.descriptionOther` : `${C}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {target === "other" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t(`${C}.carrier`)}
            htmlFor="return-code-other-carrier"
            error={errors.carrier?.message ? t(errors.carrier.message) : undefined}
          >
            <Input
              id="return-code-other-carrier"
              maxLength={60}
              placeholder={t(`${C}.carrierPlaceholder`)}
              {...form.register("carrier")}
            />
          </Field>
          {codeField}
        </div>
      ) : (
        <div className="max-w-sm">{codeField}</div>
      )}
      {values.code === "" ? (
        <p className="text-[13px] text-warning-text" data-testid="return-code-missing">
          {t(`${C}.missing`)}
        </p>
      ) : null}
    </CardForm>
  )
}

/**
 * "Anlaşmalı iade kodu" (adr/0031 Ek 2026-11-26): the one code a carrier
 * gives the shop under contract; the shopper says it at the branch and
 * pays nothing. On each contract carrier's page for its own code; on the
 * carriers tab, while BirFatura manages the parcels, with its carrier's
 * name (`other`). Optional: without one an approved return says the shop
 * will be in touch, and the card says so (a warning, nothing blocked).
 */
export function ReturnCodeCard({ target }: { target: Target }) {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<ReturnsSettings>("returns"))
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!query.data) {
    return <LoadingRows rows={2} />
  }
  const saved = query.data.values.contracted_return ?? EMPTY
  return <CodeForm key={JSON.stringify(saved)} saved={saved} target={target} />
}
