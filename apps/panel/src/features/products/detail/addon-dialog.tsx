import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@/components/patterns/form-dialog"
import { Field } from "@/components/patterns/form-section"
import { RecordStepper } from "@/components/patterns/record-stepper"
import { useDiscardGuard } from "@/components/patterns/use-discard-guard"
import { DialogBody } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ADDON_KINDS, ADDON_LIMITS } from "@/features/products/api/addons"
import type { AddonsFailure } from "./addon-failure"
import { ChoiceRows, TextRules } from "./addon-kind-fields"
import { AddonNotice } from "./addon-notice"
import { draftOf, draftSchema, valueFromDraft } from "./addon-values"
import type { AddonDraft, AddonValue } from "./addon-values"

const A = "products.addons"

interface SwitchRowProps {
  control: Control<AddonDraft>
  name: "required" | "non_withdrawable"
  label: string
  hint: string
  error: string | undefined
}

/** A yes-or-no with what it means under it; a refusal replaces the hint's colour, not its place. */
function SwitchRow({ control, name, label, hint, error }: SwitchRowProps) {
  const id = `addon-${name}`
  return (
    <div className="flex items-start justify-between gap-4 border-t pt-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </span>
        {error ? (
          <span id={`${id}-error`} role="alert" className="text-xs text-destructive-text">
            {error}
          </span>
        ) : null}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            id={id}
            aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
            aria-invalid={Boolean(error)}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
    </div>
  )
}

interface AddonDialogProps {
  /** The product's add-ons as the card holds them. */
  items: readonly AddonValue[]
  /** The one edited, by its place; null for a new one. */
  index: number | null
  /** Goes to another of the list (the arrows), after asking when something is not kept. */
  onGo: (index: number) => void
  saving: boolean
  failure: AddonsFailure | null
  onClose: () => void
  /** Saves the product's add-ons with this one in its place. */
  onSave: (value: AddonValue) => void
}

/**
 * One add-on in the product's standard dialog (adr/0052 §11), as the
 * variant's: its kind, name and help, a typed text's rules or the
 * choices, whether it is required and made to the buyer's wish; the
 * arrows go to the product's next add-on. Checked here first; saving it
 * saves the whole list. One height whichever kind shows.
 */
export function AddonDialog({
  items,
  index,
  onGo,
  saving,
  failure,
  onClose,
  onSave,
}: AddonDialogProps) {
  const { t } = useTranslation()
  const addon = index === null ? null : (items[index] ?? null)
  const form = useForm<AddonDraft>({
    resolver: zodResolver(draftSchema),
    defaultValues: draftOf(addon),
  })
  const guard = useDiscardGuard(form.formState.isDirty)
  const kind = useWatch({ control: form.control, name: "kind" })
  const { errors } = form.formState
  const error = (message: string | undefined) => (message ? t(message) : undefined)
  const submit = form.handleSubmit((draft) => {
    onSave(valueFromDraft(draft, addon))
  })
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      size="lg"
      pane="fixed"
      className="sm:h-[min(var(--dialog-max-height),40rem)]"
      title={addon ? t(`${A}.editTitle`) : t(`${A}.new`)}
      description={
        addon ? `${addon.label} · ${t(`${A}.kinds.${addon.kind}`)}` : t(`${A}.sheetHint`)
      }
      headerAction={
        index === null ? null : (
          <RecordStepper
            index={index}
            total={items.length}
            previousLabel={t(`${A}.previous`)}
            nextLabel={t(`${A}.next`)}
            disabled={saving}
            onGo={(to) => {
              const next = items[to]
              if (next) {
                guard.guard(() => {
                  form.reset(draftOf(next))
                  onGo(to)
                })
              }
            }}
          />
        )
      }
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      guard={guard}
      footerStart={
        <span className="self-center text-xs text-muted-foreground">{t(`${A}.savesAll`)}</span>
      }
    >
      <FormProvider {...form}>
        <DialogBody key={index ?? "new"}>
          <Field
            label={t(`${A}.kind`)}
            hint={t(addon ? `${A}.kindLocked` : `${A}.kindHints.${kind}`)}
          >
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={field.value}
                  disabled={addon !== null}
                  aria-label={t(`${A}.kind`)}
                  onValueChange={(next) => {
                    if (next) {
                      field.onChange(next)
                    }
                  }}
                  className="w-full"
                >
                  {ADDON_KINDS.map((each) => (
                    <ToggleGroupItem key={each} value={each} className="flex-1">
                      {t(`${A}.kinds.${each}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </Field>
          <Field
            label={t(`${A}.label`)}
            htmlFor="addon-label"
            hint={t(`${A}.labelHint`, { max: ADDON_LIMITS.label })}
            error={error(errors.label?.message)}
            required
          >
            <Input
              id="addon-label"
              maxLength={ADDON_LIMITS.label}
              aria-invalid={Boolean(errors.label)}
              {...form.register("label")}
            />
          </Field>
          <Field
            label={t(`${A}.help`)}
            htmlFor="addon-help"
            hint={t(`${A}.helpHint`, { max: ADDON_LIMITS.help })}
            error={error(errors.help?.message)}
          >
            <Input
              id="addon-help"
              maxLength={ADDON_LIMITS.help}
              aria-invalid={Boolean(errors.help)}
              {...form.register("help")}
            />
          </Field>
          {kind === "text" ? <TextRules /> : <ChoiceRows />}
          <SwitchRow
            control={form.control}
            name="required"
            label={t(`${A}.required`)}
            hint={t(`${A}.requiredHint`)}
            error={error(errors.required?.message)}
          />
          <SwitchRow
            control={form.control}
            name="non_withdrawable"
            label={t(`${A}.nonWithdrawable`)}
            hint={t(`${A}.nonWithdrawableHint`)}
            error={undefined}
          />
          {failure ? <AddonNotice tone="danger" {...failure} /> : null}
        </DialogBody>
      </FormProvider>
    </FormDialog>
  )
}
