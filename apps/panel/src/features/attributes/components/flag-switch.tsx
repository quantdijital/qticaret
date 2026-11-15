import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { TemplateForm } from "@/features/attributes/form"

export type Flag = "is_public" | "is_required" | "is_filterable" | "is_seo_highlight"

/**
 * One on/off setting of an attribute: a box of a field's height, its words
 * beside the switch, so a row of them lines up. A product option is always
 * shown; a hidden attribute is no filter and no title word (as the API
 * saves it, `definitionsApi`): those switches show the value they are held
 * at and cannot be turned.
 */
export function FlagSwitch({ index, flag }: { index: number; flag: Flag }) {
  const { t } = useTranslation()
  const { control, setValue } = useFormContext<TemplateForm>()
  const base = `definitions.${index}` as const
  const [scope, shown] = useWatch({ control, name: [`${base}.scope`, `${base}.is_public`] })
  const variant = scope === "variant"
  const held =
    flag === "is_public"
      ? variant
      : !variant && !shown && (flag === "is_filterable" || flag === "is_seo_highlight")
  return (
    <Controller
      control={control}
      name={`${base}.${flag}`}
      render={({ field }) => (
        <label className="flex h-full min-h-[var(--control-height)] cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-sm has-disabled:cursor-not-allowed has-disabled:text-muted-foreground">
          {t(`attributes.flags.${flag}`)}
          <Switch
            checked={held ? flag === "is_public" : field.value}
            disabled={held}
            onCheckedChange={(on) => {
              field.onChange(on)
              if (flag === "is_public" && !on) {
                setValue(`${base}.is_filterable`, false, { shouldDirty: true })
                setValue(`${base}.is_seo_highlight`, false, { shouldDirty: true })
              }
            }}
          />
        </label>
      )}
    />
  )
}
