import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

interface Values {
  title: string
  handle: string
}

const valuesOf = (entry: ContentDetail): Values => ({
  title: entry.title,
  handle: entry.handle,
})

const pathPrefix = (kind: ContentDetail["kind"]) => (kind === "post" ? "/blog/" : "/")

/** The title and the page's address, above its text; the summary and author fold below it. */
export function ContentGeneralCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const saved = valuesOf(entry)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const submit = form.handleSubmit((values) => {
    const { dirtyFields } = form.formState
    update.mutate(
      {
        ...(dirtyFields.title ? { title: values.title } : {}),
        ...(dirtyFields.handle ? { handle: values.handle.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.entry), FULL_RESET)
          toast.success(t("content.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t("content.general")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field label={t("content.fields.title")} htmlFor="content-title" required>
        <Input
          placeholder={t("content.placeholders.title")}
          id="content-title"
          maxLength={200}
          {...form.register("title")}
        />
      </Field>
      <Field
        label={t("content.fields.handle")}
        htmlFor="content-handle"
        hint={t("content.handleHint")}
      >
        <div className="flex items-center rounded-md border">
          <span className="pl-3 font-mono text-[13px] text-muted-foreground">
            {pathPrefix(entry.kind)}
          </span>
          <Input
            placeholder={t("content.placeholders.handle")}
            id="content-handle"
            spellCheck={false}
            className="border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
    </CardForm>
  )
}
