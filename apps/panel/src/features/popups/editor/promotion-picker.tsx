import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { promotionsQuery } from "@/features/promotions/api/promotions"
import type { PopupValues } from "@/features/popups/form"
import { useFieldError } from "./use-field-error"

const F = "popups.form"

/**
 * The campaign pop-up's promotion (adr/0080 §2), from the shop's list
 * (`GET /admin/promotion-board`). One that is not on is still offered,
 * marked: the pop-up waits for it and shows once it is on.
 */
export function PromotionPicker() {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const promotions = useQuery(promotionsQuery())
  const error = useFieldError()
  const list = promotions.data?.promotions ?? []
  return (
    <Field
      label={t(`${F}.promotion`)}
      htmlFor="popup-promotion"
      required
      error={error("promotion_id")}
    >
      <Controller
        control={control}
        name="promotion_id"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger
              id="popup-promotion"
              className="w-full"
              aria-invalid={error("promotion_id") ? true : undefined}
            >
              <SelectValue
                placeholder={
                  promotions.isPending ? t("common.loading") : t(`${F}.promotionPlaceholder`)
                }
              />
            </SelectTrigger>
            <SelectContent>
              {list.map((promotion) => (
                <SelectItem key={promotion.id} value={promotion.id}>
                  {promotion.code ?? t(`${F}.automaticPromotion`)}
                  {promotion.status === "active" ? null : (
                    <span className="text-muted-foreground"> · {t(`${F}.promotionOff`)}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {promotions.isSuccess && list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(`${F}.noPromotions`)}{" "}
          <Link to="/promotions/new" className="font-medium text-foreground hover:underline">
            {t(`${F}.newPromotion`)}
          </Link>
        </p>
      ) : null}
    </Field>
  )
}
