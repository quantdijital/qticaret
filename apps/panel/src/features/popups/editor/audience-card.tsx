import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  POPUP_DEVICES,
  POPUP_MEMBERSHIPS,
  POPUP_PAGES,
  POPUP_PAGE_SCOPES,
  POPUP_VISITORS,
} from "@/features/popups/api/types"
import type { PopupPage } from "@/features/popups/api/types"
import type { PopupValues } from "@/features/popups/form"
import { ChoiceSelect } from "./choice-select"
import { useFieldError } from "./use-field-error"

const F = "popups.form"

/**
 * Kime ve nerede (adr/0080 §3): the pages, the screen and the visitor.
 * The cart, checkout and account pages are never offered: no pop-up
 * stands between a shopper and their order.
 */
export function AudienceCard() {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const error = useFieldError()
  const scope = useWatch({ control, name: "page_scope" })
  return (
    <SectionCard title={t(`${F}.audience`)}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ChoiceSelect name="page_scope" options={POPUP_PAGE_SCOPES} label={t(`${F}.pages`)} />
          <ChoiceSelect name="device" options={POPUP_DEVICES} label={t(`${F}.device`)} />
          <ChoiceSelect name="visitor" options={POPUP_VISITORS} label={t(`${F}.visitor`)} />
          <ChoiceSelect
            name="membership"
            options={POPUP_MEMBERSHIPS}
            label={t(`${F}.membership`)}
          />
        </div>
        {scope === "selected" ? (
          <Controller
            control={control}
            name="pages"
            render={({ field }) => (
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="sr-only">{t(`${F}.pages`)}</legend>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {POPUP_PAGES.map((page) => {
                    const checked = field.value.includes(page)
                    const toggle = (on: boolean) => {
                      const next: PopupPage[] = on
                        ? [...field.value, page]
                        : field.value.filter((each) => each !== page)
                      field.onChange(next)
                    }
                    return (
                      <label
                        key={page}
                        className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            toggle(next === true)
                          }}
                        />
                        {t(`popups.choices.pages.${page}`)}
                      </label>
                    )
                  })}
                </div>
                {error("pages") ? (
                  <p role="alert" className="text-xs text-destructive-text">
                    {error("pages")}
                  </p>
                ) : null}
              </fieldset>
            )}
          />
        ) : null}
      </div>
    </SectionCard>
  )
}
