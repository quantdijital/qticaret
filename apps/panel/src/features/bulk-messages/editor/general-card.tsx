import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ChannelPicker } from "@/features/bulk-messages/components/channel-picker"
import { LIMITS } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"

const F = "bulkMessages.fields"

/**
 * The campaign's name (the panel's alone), its channel, and the
 * `utm_campaign` code its links carry: made from the name when the draft
 * was made, and kept, so the report can find what it brought.
 */
export function GeneralCard({
  form,
  utmCampaign,
}: {
  form: UseFormReturn<EditorValues>
  utmCampaign: string
}) {
  const { t } = useTranslation()
  const { errors } = form.formState
  return (
    <SectionCard title={t("bulkMessages.editor.general")}>
      <div className="grid gap-5 md:grid-cols-3">
        <Field
          label={t(`${F}.name`)}
          htmlFor="bulk-name"
          hint={t(`${F}.nameHint`)}
          error={errors.name?.message ? t(errors.name.message, { limit: LIMITS.name }) : undefined}
          required
        >
          <Input
            placeholder={t("bulkMessages.placeholders.name")}
            id="bulk-name"
            maxLength={LIMITS.name}
            aria-invalid={errors.name ? true : undefined}
            {...form.register("name")}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span id="bulk-channel" className="text-sm font-medium">
            {t(`${F}.channel`)}
          </span>
          <Controller
            control={form.control}
            name="channel"
            render={({ field }) => (
              <ChannelPicker
                value={field.value}
                onChange={field.onChange}
                labelledBy="bulk-channel"
              />
            )}
          />
          <p className="text-xs text-muted-foreground">{t(`${F}.channelHint`)}</p>
        </div>
        <Field label={t(`${F}.utm`)} htmlFor="bulk-utm" hint={t(`${F}.utmHint`)}>
          <Input id="bulk-utm" value={utmCampaign} readOnly className="font-mono text-[13px]" />
        </Field>
      </div>
    </SectionCard>
  )
}
