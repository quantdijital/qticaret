import { zodResolver } from "@hookform/resolvers/zod"
import { TriangleAlert } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useSaveSection } from "@/features/settings/api/sections"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import { errorLine } from "@/features/settings/storefront"
import { MAINTENANCE_SECTION } from "@/features/storefront/api/maintenance"
import type { MaintenanceSettings } from "@/features/storefront/api/maintenance"
import {
  MAINTENANCE_LIMITS,
  isLongMaintenance,
  maintenanceBodyOf,
  maintenanceSchema,
  maintenanceValuesOf,
  toOffsetIso,
} from "@/features/storefront/maintenance"
import type { MaintenanceParsed, MaintenanceValues } from "@/features/storefront/maintenance"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { MaintenancePathsField } from "./maintenance-paths"

const P = "storefront.maintenance.page"
const L = MAINTENANCE_LIMITS

/**
 * What the dark storefront says and leaves open (adr/0053): its heading and
 * line, when the shop expects to be back, the paths still served. The
 * owner's alone to change; the others read it as it is.
 */
export function MaintenancePageCard({
  saved,
  canWrite,
}: {
  saved: MaintenanceSettings
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const save = useSaveSection<MaintenanceSettings>(MAINTENANCE_SECTION)
  const values = maintenanceValuesOf(saved)
  const form = useForm<MaintenanceValues, unknown, MaintenanceParsed>({
    resolver: zodResolver(maintenanceSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  const message = useWatch({ control: form.control, name: "message" })
  const expected = useWatch({ control: form.control, name: "expected_at" })
  const submit = form.handleSubmit((next) => {
    const settle = beginSave(form)
    // The switch saves itself: what this card sends keeps it as stored
    save.mutate(
      { ...maintenanceBodyOf(next), enabled: saved.enabled },
      {
        onSuccess: (stored) => {
          settle(maintenanceValuesOf(stored.values))
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const titleError = errorLine(t, errors.title, L.title)
  const messageError = errorLine(t, errors.message, L.message)
  const expectedError = errorLine(t, errors.expected_at)
  return (
    <CardForm
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {canWrite ? null : (
        <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          {t(`${P}.readOnly`)}
        </p>
      )}
      <fieldset disabled={!canWrite} className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Field
            label={t(`${P}.heading`)}
            htmlFor="maintenance-title"
            hint={t(`${P}.headingHint`)}
            error={titleError}
          >
            <Input
              id="maintenance-title"
              maxLength={L.title}
              autoComplete="off"
              placeholder={t(`${P}.headingPlaceholder`)}
              aria-invalid={Boolean(titleError)}
              {...form.register("title")}
            />
          </Field>
          <Field
            label={t(`${P}.message`)}
            htmlFor="maintenance-message"
            hint={t(`${P}.messageHint`)}
            error={messageError}
          >
            <TokenSlot
              fieldId="maintenance-message"
              multiline
              onInsert={(text) => {
                form.setValue("message", text, { shouldDirty: true, shouldValidate: true })
              }}
            >
              <Textarea
                placeholder={t("storefront.placeholders.maintenance")}
                id="maintenance-message"
                rows={4}
                maxLength={L.message}
                aria-invalid={Boolean(messageError)}
                className="pr-9"
                {...form.register("message")}
              />
            </TokenSlot>
            <ShopTokenPreview text={message} />
          </Field>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Field
            label={t(`${P}.expectedAt`)}
            htmlFor="maintenance-expected"
            hint={t(`${P}.expectedAtHint`)}
            error={expectedError}
          >
            <Input
              id="maintenance-expected"
              type="datetime-local"
              aria-invalid={Boolean(expectedError)}
              className="sm:w-64"
              {...form.register("expected_at")}
            />
            {isLongMaintenance(toOffsetIso(expected)) ? (
              <p className="flex gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t(`${P}.long`)}
              </p>
            ) : null}
          </Field>
          <MaintenancePathsField control={form.control} register={form.register} errors={errors} />
        </div>
      </fieldset>
    </CardForm>
  )
}
