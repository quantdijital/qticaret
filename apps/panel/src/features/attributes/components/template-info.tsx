import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import type { TemplateForm } from "@/features/attributes/form"
import { toSlug } from "@/lib/slug"

const A = "attributes"

/**
 * The template itself: its name, its short name (fixed once saved) and a
 * note for the shop; a saved one can be deleted from here.
 */
export function TemplateInfo({ saved, onDelete }: { saved: boolean; onDelete: () => void }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<TemplateForm>()
  const name = useWatch({ control, name: "name" })
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(`${A}.templateName`)} htmlFor="template-name" required>
          <Input id="template-name" {...register("name")} />
        </Field>
        <Field label={t(`${A}.handle`)} htmlFor="template-handle" hint={t(`${A}.handleHint`)}>
          <Input
            id="template-handle"
            placeholder={toSlug(name)}
            disabled={saved}
            className="font-mono text-[13px]"
            {...register("handle")}
          />
        </Field>
      </div>
      <Field
        label={t(`${A}.description`)}
        htmlFor="template-description"
        hint={t(`${A}.descriptionHint`)}
      >
        <Textarea id="template-description" className="min-h-16" {...register("description")} />
      </Field>
      {saved ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-[13px] text-muted-foreground">{t(`${A}.deleteDescription`)}</p>
          <Button
            type="button"
            variant="outline"
            className="text-destructive-text"
            onClick={onDelete}
          >
            <Trash2 />
            {t(`${A}.deleteTemplate`)}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
