import { ChevronDown, ChevronRight } from "lucide-react"
import { useId } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import type { TemplateForm } from "@/features/attributes/form"
import { toSlug } from "@/lib/slug"

const A = "attributes"

/**
 * The group's name, above its tabs: the one thing a new group needs.
 * Its short name (fixed once saved) and a note for the shop fold under
 * "Diğer ayarlar".
 */
export function TemplateInfo({
  saved,
  more,
  onMoreChange,
}: {
  saved: boolean
  more: boolean
  onMoreChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<TemplateForm>()
  const name = useWatch({ control, name: "name" })
  const bodyId = useId()
  return (
    <div className="flex flex-col gap-3">
      <Field label={t(`${A}.templateName`)} htmlFor="template-name" required>
        <Input
          id="template-name"
          placeholder={t(`${A}.templateNamePlaceholder`)}
          className="sm:max-w-sm"
          {...register("name")}
        />
      </Field>
      <button
        type="button"
        aria-expanded={more}
        aria-controls={more ? bodyId : undefined}
        className="flex h-8 items-center gap-1.5 self-start rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => {
          onMoreChange(!more)
        }}
      >
        {more ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {t(`${A}.more`)}
      </button>
      {more ? (
        <div id={bodyId} className="grid gap-4 border-l pl-4 sm:grid-cols-2">
          <Field label={t(`${A}.handle`)} htmlFor="template-handle" hint={t(`${A}.handleHint`)}>
            <Input
              id="template-handle"
              placeholder={toSlug(name)}
              disabled={saved}
              className="font-mono text-[13px]"
              {...register("handle")}
            />
          </Field>
          <Field
            label={t(`${A}.description`)}
            htmlFor="template-description"
            hint={t(`${A}.descriptionHint`)}
          >
            <Textarea
              id="template-description"
              className="min-h-[var(--control-height)]"
              {...register("description")}
            />
          </Field>
        </div>
      ) : null}
    </div>
  )
}
