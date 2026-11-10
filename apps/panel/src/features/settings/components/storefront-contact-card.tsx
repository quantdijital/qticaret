import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { contactFormSchema, errorLine, useSaveStorefront } from "@/features/settings/storefront"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const C = "settings.storefront.contactForm"
// What the field offers when the form is turned back on: the server's own default
const DEFAULT_PATH = "/iletisim"

type Values = z.infer<typeof contactFormSchema>

const valuesOf = (saved: StorefrontSettings): Values => ({
  enabled: saved.contact_form_path !== null,
  path: saved.contact_form_path ?? DEFAULT_PATH,
})

/**
 * The page the storefront's contact form shows on, below its text
 * (adr/0047); turned off, the storefront shows no form and the path is
 * saved as none.
 */
export function ContactFormCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(contactFormSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const enabled = useWatch({ control: form.control, name: "enabled" })
  const submit = form.handleSubmit((next) => {
    save({ contact_form_path: next.enabled ? next.path : null }, (stored) => {
      form.reset(valuesOf(stored), FULL_RESET)
    })
  })
  const error = errorLine(t, form.formState.errors.path)
  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="storefront-contact-enabled" className="text-sm font-medium">
            {t(`${C}.enabled`)}
          </label>
          <span id="storefront-contact-enabled-hint" className="text-[13px] text-muted-foreground">
            {t(`${C}.hint`)}
          </span>
        </div>
        <Controller
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <Switch
              id="storefront-contact-enabled"
              aria-describedby="storefront-contact-enabled-hint"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
      {enabled ? (
        <Field
          label={t(`${C}.path`)}
          htmlFor="storefront-contact-path"
          hint={t(`${C}.pathHint`)}
          error={error}
        >
          <Input
            id="storefront-contact-path"
            autoComplete="off"
            placeholder={DEFAULT_PATH}
            aria-invalid={Boolean(error)}
            className="sm:w-80"
            {...form.register("path")}
          />
        </Field>
      ) : null}
    </CardForm>
  )
}
