import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import type { PickerOption } from "@/components/patterns/search-picker"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { NO_FINDINGS } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { Counter } from "@/features/seo/components/seo-card"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { AuthorSelect } from "./author-select"
import { FindingsNote } from "./findings-note"

interface Values {
  excerpt: string
  author: PickerOption | null
}

const valuesOf = (entry: ContentDetail): Values => ({
  excerpt: entry.excerpt ?? "",
  author: entry.author ? { id: entry.author.id, label: entry.author.name } : null,
})

// The longest summary written here: counted under the field
const EXCERPT_MAX = 500

/**
 * The summary lists and search results show and, for a post, its author
 * chosen from the blog's authors (each with a page of their own), in the
 * page's narrow column (docs/06 "Metin sayfaları"); the summary's length
 * is counted under it.
 */
export function ContentSummaryCard({
  entry,
  findings = NO_FINDINGS,
}: {
  entry: ContentDetail
  /** The advisor's for this card, counted under it. */
  findings?: SectionFindings
}) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const saved = valuesOf(entry)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const excerpt = useWatch({ control: form.control, name: "excerpt" })
  const post = entry.kind === "post"
  const submit = form.handleSubmit((values) => {
    const { dirtyFields } = form.formState
    update.mutate(
      {
        ...(dirtyFields.excerpt ? { excerpt: values.excerpt.trim() || null } : {}),
        ...(dirtyFields.author ? { author_id: values.author?.id ?? null } : {}),
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
      title={t(post ? "content.summaryAndAuthor" : "content.summary")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field
        label={t("content.fields.excerpt")}
        htmlFor="content-excerpt"
        hint={t("content.excerptHint")}
      >
        <div className="flex flex-col gap-1">
          <Textarea
            id="content-excerpt"
            maxLength={EXCERPT_MAX}
            // Grows with the text, up to a few lines; longer scrolls inside
            className="max-h-60 min-h-24"
            {...form.register("excerpt")}
          />
          <div className="flex justify-end">
            <Counter length={excerpt.length} limit={EXCERPT_MAX} />
          </div>
        </div>
      </Field>
      {post ? (
        <Field
          label={t("content.fields.author")}
          htmlFor="content-author"
          hint={t("content.authorHint")}
        >
          <Controller
            control={form.control}
            name="author"
            render={({ field }) => (
              <AuthorSelect
                id="content-author"
                value={field.value}
                onChange={field.onChange}
                legacyName={entry.author ? null : entry.author_name}
              />
            )}
          />
        </Field>
      ) : null}
      <FindingsNote findings={findings} />
    </CardForm>
  )
}
