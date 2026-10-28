import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { errorText } from "@/lib/errors"

interface Values {
  title: string
  handle: string
  excerpt: string
  author_name: string
}

const pathPrefix = (kind: ContentDetail["kind"]) => (kind === "post" ? "/blog/" : "/")

/** The title, page address, summary and (for a post) its author. */
export function ContentGeneralCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const saved: Values = {
    title: entry.title,
    handle: entry.handle,
    excerpt: entry.excerpt ?? "",
    author_name: entry.author_name ?? "",
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const submit = form.handleSubmit((values) => {
    const { dirtyFields } = form.formState
    update.mutate(
      {
        ...(dirtyFields.title ? { title: values.title } : {}),
        ...(dirtyFields.handle ? { handle: values.handle.trim() } : {}),
        ...(dirtyFields.excerpt ? { excerpt: values.excerpt.trim() || null } : {}),
        ...(dirtyFields.author_name ? { author_name: values.author_name.trim() || null } : {}),
      },
      {
        onSuccess: () => toast.success(t("content.saved")),
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
        form.reset(saved)
      }}
    >
      <Field label={t("content.fields.title")} htmlFor="content-title" required>
        <Input id="content-title" maxLength={200} {...form.register("title")} />
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
            id="content-handle"
            spellCheck={false}
            className="border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
      <Field
        label={t("content.fields.excerpt")}
        htmlFor="content-excerpt"
        hint={t("content.excerptHint")}
      >
        <Textarea
          id="content-excerpt"
          maxLength={500}
          className="min-h-20"
          {...form.register("excerpt")}
        />
      </Field>
      {entry.kind === "post" ? (
        <Field
          label={t("content.fields.author")}
          htmlFor="content-author"
          hint={t("content.authorHint")}
        >
          <Input id="content-author" maxLength={120} {...form.register("author_name")} />
        </Field>
      ) : null}
    </CardForm>
  )
}
