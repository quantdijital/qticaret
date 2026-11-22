import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { Input } from "@qticaret/admin-ui/ui/input"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { useFeature } from "@/features/settings/api/features"
import { BOOKING_NOTE_MAX, sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { BookingFlowSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const F = "settings.shipping.bookingFlow"

// One line of clean text, as the server keeps it: no line breaks or other control characters
function isClean(text: string): boolean {
  // Control characters are single UTF-16 units: one index at a time is enough
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      return false
    }
  }
  return true
}
const note = z
  .string()
  .max(BOOKING_NOTE_MAX, `${F}.noteTooLong`)
  .refine(isClean, `${F}.noteInvalid`)
const schema = z.object({
  voucher_enabled: z.boolean(),
  voucher_off_note: note,
  online_cancel_enabled: z.boolean(),
  cancel_off_note: note,
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: BookingFlowSettings): Values => ({
  voucher_enabled: saved.voucher_enabled,
  voucher_off_note: saved.voucher_off_note ?? "",
  online_cancel_enabled: saved.online_cancel_enabled,
  cancel_off_note: saved.cancel_off_note ?? "",
})

/** A flow's switch and, while it is off, the note the shopper reads in its place. */
function FlowSwitch({
  form,
  name,
  noteName,
  label,
}: {
  form: UseFormReturn<Values>
  name: "voucher_enabled" | "online_cancel_enabled"
  noteName: "voucher_off_note" | "cancel_off_note"
  label: "voucher" | "onlineCancel"
}) {
  const { t } = useTranslation()
  const on = useWatch({ control: form.control, name })
  const noteKey = label === "voucher" ? "voucherNote" : "cancelNote"
  const error = form.formState.errors[noteName]?.message
  const id = `booking-flow-${name}`
  return (
    <div className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={id} className="text-sm font-medium">
            {t(`${F}.${label}`)}
          </label>
          <span id={`${id}-hint`} className="text-[13px] text-muted-foreground">
            {t(`${F}.${label}Hint`)}
          </span>
        </div>
        <Switch
          id={id}
          aria-describedby={`${id}-hint`}
          checked={on}
          onCheckedChange={(checked) => {
            form.setValue(name, checked, { shouldDirty: true })
          }}
        />
      </div>
      {on ? null : (
        <Field
          label={t(`${F}.${noteKey}`)}
          htmlFor={`booking-flow-${noteName}`}
          hint={t(label === "voucher" ? `${F}.noteHint` : `${F}.cancelNoteHint`)}
          error={error ? t(error, { max: BOOKING_NOTE_MAX }) : undefined}
        >
          <Input
            id={`booking-flow-${noteName}`}
            maxLength={BOOKING_NOTE_MAX}
            placeholder={t(`${F}.${noteKey}Default`)}
            aria-invalid={Boolean(error)}
            {...form.register(noteName)}
          />
        </Field>
      )}
    </div>
  )
}

function Form({ saved }: { saved: BookingFlowSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<BookingFlowSettings>("booking")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    save.mutate(next, {
      onSuccess: (result) => {
        form.reset(valuesOf(result.values), FULL_RESET)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  return (
    <CardForm
      title={t(`${F}.title`)}
      description={t(`${F}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <FlowSwitch form={form} name="voucher_enabled" noteName="voucher_off_note" label="voucher" />
      <FlowSwitch
        form={form}
        name="online_cancel_enabled"
        noteName="cancel_off_note"
        label="onlineCancel"
      />
    </CardForm>
  )
}

/**
 * Settings > Shipping > Returns: the simple path of dated products
 * (adr/0076 Ek basit yol). Vouchers and the shopper's online cancel, each
 * on by default; off, the shopper reads the shop's note. Shown only while
 * the shop sells dated products: a shop that does not meets nothing new.
 */
export function BookingFlowCard() {
  const on = useFeature(BOOKING_FLAG)
  const query = useQuery({ ...sectionQuery<BookingFlowSettings>("booking"), enabled: on })
  if (!on) {
    return null
  }
  return query.data ? <Form saved={query.data.values} /> : <Skeleton className="h-48 rounded-lg" />
}
