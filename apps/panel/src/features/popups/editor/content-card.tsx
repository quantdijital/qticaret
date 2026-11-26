import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { MediaField } from "@/components/patterns/media-field"
import { POPUP_LIMITS, POPUP_TYPES } from "@/features/popups/api/types"
import type { PopupType } from "@/features/popups/api/types"
import { switchType } from "@/features/popups/form"
import type { PopupValues } from "@/features/popups/form"
import { PromotionPicker } from "./promotion-picker"
import { useFieldError } from "./use-field-error"

const F = "popups.form"

/**
 * The pop-up's type, its words, picture and button (adr/0080 §2). On a new
 * one whose design is untouched, the design follows the type's suggestion.
 */
export function ContentCard({ isNew = false }: { isNew?: boolean }) {
  const { t } = useTranslation()
  const form = useFormContext<PopupValues>()
  const { register, control } = form
  const error = useFieldError()
  const [type, imageUrl] = useWatch({ control, name: ["type", "image_url"] })
  return (
    <SectionCard title={t(`${F}.content`)}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t(`${F}.name`)}
            htmlFor="popup-name"
            hint={t(`${F}.nameHint`)}
            error={error("name")}
            required
          >
            <Input
              placeholder={t("popups.placeholders.name")}
              id="popup-name"
              maxLength={POPUP_LIMITS.name}
              {...register("name")}
            />
          </Field>
          <Field label={t(`${F}.type`)} htmlFor="popup-type">
            <Select
              value={type}
              onValueChange={(next) => {
                const values = switchType(form.getValues(), next as PopupType, {
                  suggest: isNew && !form.getFieldState("design").isDirty,
                })
                // A suggestion, not a choice: the design stays free to follow the next type
                form.setValue("design", values.design)
                form.setValue("type", values.type, { shouldDirty: true })
                form.setValue("promotion_id", values.promotion_id, { shouldDirty: true })
                form.setValue("button_href", values.button_href, { shouldDirty: true })
                form.clearErrors(["promotion_id", "button_href", "button_label"])
              }}
            >
              <SelectTrigger id="popup-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POPUP_TYPES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`popups.types.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t(`${F}.title`)} htmlFor="popup-title" error={error("title")} required>
          <Input
            placeholder={t("popups.placeholders.title")}
            id="popup-title"
            maxLength={POPUP_LIMITS.title}
            {...register("title")}
          />
        </Field>
        <Field label={t(`${F}.body`)} htmlFor="popup-body" error={error("body")}>
          <Textarea
            placeholder={t("popups.placeholders.body")}
            id="popup-body"
            rows={4}
            maxLength={POPUP_LIMITS.body}
            {...register("body")}
          />
        </Field>
        {type === "campaign" ? <PromotionPicker /> : null}
        {type === "newsletter" ? (
          <Field
            label={t(`${F}.submitLabel`)}
            htmlFor="popup-button-label"
            hint={t(`${F}.submitLabelHint`)}
            error={error("button_label")}
          >
            <Input
              placeholder={t("popups.placeholders.submitLabel")}
              id="popup-button-label"
              maxLength={POPUP_LIMITS.buttonLabel}
              {...register("button_label")}
            />
          </Field>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t(`${F}.buttonLabel`)}
              htmlFor="popup-button-label"
              error={error("button_label")}
            >
              <Input
                placeholder={t("popups.placeholders.buttonLabel")}
                id="popup-button-label"
                maxLength={POPUP_LIMITS.buttonLabel}
                {...register("button_label")}
              />
            </Field>
            <Field
              label={t(`${F}.buttonHref`)}
              htmlFor="popup-button-href"
              error={error("button_href")}
            >
              <Input
                id="popup-button-href"
                placeholder="/kategori/yeni-sezon"
                maxLength={POPUP_LIMITS.href}
                {...register("button_href")}
              />
            </Field>
          </div>
        )}
        <Controller
          control={control}
          name="image_url"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <MediaField
                id="popup-image"
                label={t(`${F}.image`)}
                value={field.value || null}
                frame="wide"
                className="max-w-md"
                emptyText={t(`${F}.imageAdd`)}
                onChange={(asset) => {
                  field.onChange(asset?.url ?? "")
                  form.clearErrors("image_url")
                  // A library image's own alt text fills an empty one
                  if (asset?.alt && !form.getValues("image_alt").trim()) {
                    form.setValue("image_alt", asset.alt, { shouldDirty: true })
                  }
                }}
              >
                {imageUrl ? (
                  <Field
                    label={t(`${F}.imageAlt`)}
                    htmlFor="popup-image-alt"
                    error={error("image_alt")}
                  >
                    <Input
                      placeholder={t("common.placeholder.imageAlt")}
                      id="popup-image-alt"
                      maxLength={POPUP_LIMITS.imageAlt}
                      {...register("image_alt")}
                    />
                  </Field>
                ) : null}
              </MediaField>
              {error("image_url") ? (
                <p role="alert" className="text-xs text-destructive-text">
                  {error("image_url")}
                </p>
              ) : null}
            </div>
          )}
        />
      </div>
    </SectionCard>
  )
}
