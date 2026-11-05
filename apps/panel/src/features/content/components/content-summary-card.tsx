import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { NO_FINDINGS, summaryLine } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { excerpt as cutText, plainText } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

interface Values {
  excerpt: string
  author_name: string
}

const valuesOf = (entry: ContentDetail): Values => ({
  excerpt: entry.excerpt ?? "",
  author_name: entry.author_name ?? "",
})

// The summary's start, short enough that the findings after it stay in the line
const opening = (text: string) => {
  const cut = cutText(text, 70)
  return cut.length < plainText(text).length ? `${cut}…` : cut
}

/**
 * The summary lists and search results show and, for a post, its author:
 * folded under the text to a line that says what is written.
 */
export function ContentSummaryCard({
  entry,
  findings = NO_FINDINGS,
}: {
  entry: ContentDetail
  /** The advisor's for this section: counted in its line, an urgent one opens it. */
  findings?: SectionFindings
}) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const saved = valuesOf(entry)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const [excerpt, author] = useWatch({ control: form.control, name: ["excerpt", "author_name"] })
  const post = entry.kind === "post"
  const submit = form.handleSubmit((values) => {
    const { dirtyFields } = form.formState
    update.mutate(
      {
        ...(dirtyFields.excerpt ? { excerpt: values.excerpt.trim() || null } : {}),
        ...(dirtyFields.author_name ? { author_name: values.author_name.trim() || null } : {}),
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
  const byline = author.trim()
    ? t("content.sections.author", { name: author.trim() })
    : t("content.sections.noAuthor")
  return (
    <CardForm
      title={t(post ? "content.summaryAndAuthor" : "content.summary")}
      description={t("content.summaryHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
      collapse={{
        id: "content-summary",
        name: "content.summary",
        attention: findings.attention,
        summary: summaryLine(
          t,
          [post ? byline : undefined, opening(excerpt) || t("content.sections.excerptEmpty")],
          findings
        ),
      }}
    >
      <Field
        label={t("content.fields.excerpt")}
        htmlFor="content-excerpt"
        hint={t("content.excerptHint")}
      >
        <Textarea
          id="content-excerpt"
          maxLength={500}
          // Grows with the text, up to a few lines; longer scrolls inside
          className="max-h-60 min-h-20"
          {...form.register("excerpt")}
        />
      </Field>
      {post ? (
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
