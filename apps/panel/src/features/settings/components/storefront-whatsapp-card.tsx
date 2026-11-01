import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { errorLine, phoneSchema, useSaveStorefront } from "@/features/settings/storefront"

const W = "settings.storefront.whatsapp"

const schema = z.object({ phone: phoneSchema })
type Values = z.infer<typeof schema>

const valuesOf = (saved: StorefrontSettings): Values => ({ phone: saved.whatsapp_phone ?? "" })

/** The number the storefront's WhatsApp button opens; empty: no button. */
export function WhatsappCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    // The server writes it as +90…; the field shows what it stored
    save({ whatsapp_phone: next.phone === "" ? null : next.phone }, (stored) => {
      form.reset(valuesOf(stored))
    })
  })
  const error = errorLine(t, form.formState.errors.phone)
  return (
    <CardForm
      title={t(`${W}.title`)}
      description={t(`${W}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      <Field
        label={t(`${W}.phone`)}
        htmlFor="storefront-whatsapp"
        hint={t(`${W}.hint`)}
        error={error}
      >
        <Input
          id="storefront-whatsapp"
          type="tel"
          autoComplete="off"
          placeholder="0532 123 45 67"
          aria-invalid={Boolean(error)}
          className="sm:w-80"
          {...form.register("phone")}
        />
      </Field>
    </CardForm>
  )
}
