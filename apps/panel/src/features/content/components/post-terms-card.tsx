import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import type { TermView } from "@/features/content/api/terms"
import { CategoryPicker } from "@/features/content/components/category-picker"
import { TagPicker } from "@/features/content/components/tag-picker"
import { NO_FINDINGS } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { errorText } from "@/lib/errors"
import { FindingsNote } from "./findings-note"

const T = "content.terms"

interface Filing {
  category: TermView | null
  tags: TermView[]
}

const sameTags = (a: readonly TermView[], b: readonly TermView[]) =>
  a.length === b.length && a.every((tag) => b.some((other) => other.id === tag.id))

/**
 * Where a blog post is filed (adr/0019 ek 2026-11-03): one category and
 * any tags, saved with the post. A tag typed that the shop has not got
 * yet is made on the spot and joins the post with the save. In the
 * page's narrow column (docs/06 "Metin sayfaları").
 */
export function PostTermsCard({
  entry,
  findings = NO_FINDINGS,
}: {
  entry: ContentDetail
  /** The advisor's for this card, counted under it. */
  findings?: SectionFindings
}) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const saved: Filing = { category: entry.category, tags: entry.tags }
  // What was changed here; none: the post's own
  const [draft, setDraft] = useState<Filing | null>(null)
  const shown = draft ?? saved
  const dirty =
    draft !== null &&
    (draft.category?.id !== saved.category?.id || !sameTags(draft.tags, saved.tags))
  const set = (next: Partial<Filing>) => {
    setDraft({ ...shown, ...next })
  }
  return (
    <CardForm
      title={t(`${T}.cardTitle`)}
      description={t(`${T}.cardHint`)}
      dirty={dirty}
      saving={update.isPending}
      onSubmit={() => {
        if (!draft) {
          return
        }
        const sent = draft
        update.mutate(
          { category_id: sent.category?.id ?? null, tag_ids: sent.tags.map((tag) => tag.id) },
          {
            onSuccess: () => {
              setDraft((current) => (current === sent ? null : current))
              toast.success(t("content.saved"))
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
      onReset={() => {
        setDraft(null)
      }}
    >
      <Field label={t(`${T}.category`)} htmlFor="post-category">
        <CategoryPicker
          id="post-category"
          value={shown.category}
          onChange={(category) => {
            set({ category })
          }}
        />
      </Field>
      {/* The add button keeps its own name; the badges' list is named by the label's words */}
      <Field label={t(`${T}.tags`)}>
        <TagPicker
          id="post-tags"
          value={shown.tags}
          onChange={(tags) => {
            set({ tags })
          }}
        />
      </Field>
      <Link
        to="/content"
        search={{ kind: "category" }}
        className="w-fit text-[13px] text-primary-text underline-offset-4 hover:underline"
      >
        {t(`${T}.manage`)}
      </Link>
      <FindingsNote findings={findings} />
    </CardForm>
  )
}
