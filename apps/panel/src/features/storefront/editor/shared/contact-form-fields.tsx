import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { contactFormSchema, errorLine, useSaveStorefront } from "@/features/settings/storefront"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { HintedName } from "../forms/field-hint"
import { rolePageId } from "../page-roles"
import { useContentPages } from "../use-content-pages"
import type { ContentPageOption } from "../use-content-pages"
import { PageRolePicker } from "./page-role-picker"

const C = "settings.storefront.contactForm"

type Values = z.infer<typeof contactFormSchema>

// A section saved before the ids: its old path read as the page at that address
const valuesOf = (saved: StorefrontSettings, pages: readonly ContentPageOption[] | undefined) => {
  const page = rolePageId(saved, "contact", pages)
  return { enabled: page !== null, page }
}

/**
 * The page the storefront's contact form shows on, below its text
 * (adr/0047): one of İçerik's pages, kept by its id so a renamed page keeps
 * the form (adr/0073 Açık kararlar 3); turned off, the storefront shows no
 * form. Saved at once to the storefront section, not the draft.
 */
export function ContactFormFields({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const pages = useContentPages().data?.pages
  const values: Values = valuesOf(saved, pages)
  const form = useForm<Values>({
    resolver: zodResolver(contactFormSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const enabled = useWatch({ control: form.control, name: "enabled" })
  const submit = form.handleSubmit((next) => {
    const settle = beginSave(form)
    save({ contact_page_id: next.enabled ? next.page : null }, (stored) => {
      settle(valuesOf(stored, pages))
    })
  })
  const error = errorLine(t, form.formState.errors.page)
  return (
    <CardForm
      bare
      title={t(`${C}.title`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <HintedName
          name={t(`${C}.enabled`)}
          hint={t(`${C}.hint`)}
          hintId="storefront-contact-enabled-hint"
        >
          <label htmlFor="storefront-contact-enabled" className="text-sm">
            {t(`${C}.enabled`)}
          </label>
        </HintedName>
        <HiddenHint id="storefront-contact-enabled-hint">{t(`${C}.hint`)}</HiddenHint>
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
          label={t(`${C}.page`)}
          htmlFor="storefront-contact-page"
          hint={t(`${C}.pageHint`)}
          error={error}
        >
          <Controller
            control={form.control}
            name="page"
            render={({ field }) => (
              <PageRolePicker
                id="storefront-contact-page"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(error)}
              />
            )}
          />
        </Field>
      ) : null}
    </CardForm>
  )
}
