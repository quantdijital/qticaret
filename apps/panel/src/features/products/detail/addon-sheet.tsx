import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

interface AddonSheetProps {
  /** The add-on edited; null for a new one. */
  addon: AddonValue | null
  saving: boolean
  failure: AddonsFailure | null
  onClose: () => void
  /** Saves the product's add-ons with this one in its place. */
  onSave: (value: AddonValue) => void
}

/**
 * One add-on in a side sheet (adr/0052 §11): its kind, name and help, a
 * typed text's rules or the choices, whether it is required and made to
 * the buyer's wish. Checked here first; saving it saves the whole list.
 */
export function AddonSheet({ addon, saving, failure, onClose, onSave }: AddonSheetProps) {
  const { t } = useTranslation()
  const form = useForm<AddonDraft>({
    resolver: zodResolver(draftSchema),
    defaultValues: draftOf(addon),
  })
  const kind = useWatch({ control: form.control, name: "kind" })
  const { errors } = form.formState
  const error = (message: string | undefined) => (message ? t(message) : undefined)
  const submit = form.handleSubmit((draft) => {
    onSave(valueFromDraft(draft, addon))
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{addon ? addon.label : t(`${A}.new`)}</SheetTitle>
          <SheetDescription>{t(`${A}.sheetHint`)}</SheetDescription>
        </SheetHeader>
        <FormProvider {...form}>
          <form
            id="addon-form"
            noValidate
            onSubmit={(event) => {
              void submit(event)
            }}
            className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
          >
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
          </form>
        </FormProvider>
        <SheetFooter className="flex-row items-center justify-between gap-3 border-t px-6 py-3">
          <span className="text-xs text-muted-foreground">{t(`${A}.savesAll`)}</span>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="addon-form" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
