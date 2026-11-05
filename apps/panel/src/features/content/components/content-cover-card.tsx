import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
import { Input } from "@/components/ui/input"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { NO_FINDINGS, summaryLine } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

interface Values {
  image_url: string
  image_alt: string
}

const valuesOf = (entry: ContentDetail): Values => ({
  image_url: entry.image_url ?? "",
  image_alt: entry.image_alt ?? "",
})

/** The cover: the list's and the share card's image, with its alt text (docs/13 §8); folded to a line. */
export function ContentCoverCard({
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
  const [url, alt] = useWatch({ control: form.control, name: ["image_url", "image_alt"] })
  const submit = form.handleSubmit((values) => {
    update.mutate(
      { image_url: values.image_url || null, image_alt: values.image_alt.trim() || null },
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
      title={t("content.cover")}
      description={t("content.coverHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
      collapse={{
        id: "content-cover-section",
        name: "content.cover",
        attention: findings.attention,
        summary: summaryLine(
          t,
          [
            url
              ? t(alt.trim() ? "content.sections.coverAlt" : "content.sections.coverNoAlt")
              : t("content.noCover"),
          ],
          findings
        ),
      }}
    >
      <MediaField
        id="content-cover"
        label={t("content.cover")}
        value={url || null}
        frame="share"
        hideLabel
        emptyText={t("content.noCover")}
        onChange={(asset) => {
          form.setValue("image_url", asset?.url ?? "", { shouldDirty: true })
          // A library image's own alt text fills an empty one
          if (asset?.alt && !form.getValues("image_alt").trim()) {
            form.setValue("image_alt", asset.alt, { shouldDirty: true })
          }
        }}
      >
        <Field
          label={t("content.fields.coverAlt")}
          htmlFor="content-cover-alt"
          hint={t("content.coverAltHint")}
        >
          <Input id="content-cover-alt" maxLength={300} {...form.register("image_alt")} />
        </Field>
      </MediaField>
    </CardForm>
  )
}
