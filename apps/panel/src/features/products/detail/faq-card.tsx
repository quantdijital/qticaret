import { useQuery } from "@tanstack/react-query"
import { Plus, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiTryOthers } from "@/features/ai/components/ai-try-others"
import { FAQ_LIMITS, faqItemIssue } from "@/features/ai/faq"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import { useCan } from "@/features/auth/api/staff"
import { productQuestionsQuery } from "@/features/reviews/api/questions"
import type { QuestionRow } from "@/features/reviews/api/questions"
import { QuestionDialog } from "@/features/reviews/components/question-dialog"
import { errorText } from "@/lib/errors"
import { ProductQuestions } from "./product-questions"
import { PRODUCT_SECTIONS } from "./sections"
import { useFaqAi } from "./use-faq-ai"
import type { FaqAi, FaqDraftItem } from "./use-faq-ai"

/** One item of the draft: kept or not, its question and answer editable. */
function FaqItemEditor({
  item,
  index,
  onChange,
}: {
  item: FaqDraftItem
  index: number
  onChange: (patch: Partial<FaqDraftItem>) => void
}) {
  const { t } = useTranslation()
  const issue = item.kept ? faqItemIssue(item) : null
  const id = `faq-item-${String(index)}`
  return (
    <li className="flex gap-3 rounded-md border bg-card p-3" data-slot="ai-faq-item">
      <Checkbox
        className="mt-1"
        checked={item.kept}
        aria-label={t("products.faq.keep", { number: index + 1 })}
        onCheckedChange={(value) => {
          onChange({ kept: value === true })
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-q`} className="text-xs text-muted-foreground">
            {t("products.faq.question")}
          </Label>
          <Input
            placeholder={t("products.placeholders.faqQuestion")}
            id={`${id}-q`}
            value={item.question}
            maxLength={FAQ_LIMITS.question}
            disabled={!item.kept}
            onChange={(event) => {
              onChange({ question: event.target.value })
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-a`} className="text-xs text-muted-foreground">
            {t("products.faq.answer")}
          </Label>
          <Textarea
            placeholder={t("products.placeholders.faqAnswer")}
            id={`${id}-a`}
            rows={2}
            value={item.answer}
            maxLength={FAQ_LIMITS.answer}
            disabled={!item.kept}
            onChange={(event) => {
              onChange({ answer: event.target.value })
            }}
          />
        </div>
        {issue ? (
          <p className="text-xs text-destructive" role="alert">
            {t(`products.faq.issues.${issue}`)}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/** The draft under the card's title: its state, the items, "Seçilenleri ekle" and the cancel kind. */
function FaqDraft({ ai }: { ai: FaqAi }) {
  const { t } = useTranslation()
  if (ai.usable.length === 0) {
    return <AiConnectHint onClose={ai.hideHint} />
  }
  const { state } = ai
  const add = async () => {
    const added = await ai.add()
    if (added > 0) {
      toast.success(t("products.faq.added", { count: added }))
    }
  }
  return (
    <section
      aria-label={t("products.faq.draft")}
      className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3"
      data-slot="ai-faq"
    >
      <AiServicePicker
        services={ai.usable}
        value={ai.service}
        disabled={state.status === "loading" || ai.adding}
        onChange={ai.pick}
      />
      <div role="status" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" || state.status === "idle" ? (
          <>
            <span className="sr-only">{t("ai.suggest.loading")}</span>
            <Skeleton className="h-20 w-full" />
          </>
        ) : null}
        {state.status === "suggestion" ? (
          <p className="text-xs text-muted-foreground">
            {t("ai.suggest.from", { name: serviceName(t, state.suggestion.service) })}
          </p>
        ) : null}
        {state.status === "refused" ? <p className="text-sm">{t("ai.suggest.refused")}</p> : null}
        {state.status === "error" ? (
          <p className="text-sm text-destructive">
            {aiFailureText(t, state.failure, state.service)}
          </p>
        ) : null}
      </div>
      {state.status === "refused" || state.status === "error" ? (
        <AiTryOthers services={state.alternatives} onTryWith={ai.tryWith} />
      ) : null}
      {ai.items.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{t("products.faq.hint")}</p>
          <ul className="flex flex-col gap-2">
            {ai.items.map((item, index) => (
              <FaqItemEditor
                key={index}
                item={item}
                index={index}
                onChange={(patch) => {
                  ai.change(index, patch)
                }}
              />
            ))}
          </ul>
        </>
      ) : null}
      {ai.failure ? (
        <p className="text-sm text-destructive" role="alert">
          {errorText(t, ai.failure)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {ai.items.length > 0 ? (
          <Button
            type="button"
            size="sm"
            disabled={!ai.ready || ai.adding}
            onClick={() => {
              void add()
            }}
          >
            <Plus />
            {t("products.faq.add", { count: ai.keptCount })}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={state.status === "loading" || ai.adding}
          onClick={ai.retry}
        >
          {t("ai.suggest.retry")}
        </Button>
        <Button type="button" size="sm" variant="cancel" disabled={ai.adding} onClick={ai.close}>
          {t("products.faq.close")}
        </Button>
      </div>
    </section>
  )
}

/**
 * The product's questions and answers (adr/0074 §5 madde 4; owner
 * 2026-11-27): the list of this product's questions, the shop's own and
 * customers', each opening its dialog (edit, hide or show, delete);
 * "Soru ekle" adds one by hand in the shop's name, and "SSS taslağı" a
 * draft from the product's own facts, each editable, those kept added the
 * same way. Both are published at once and appear in the list.
 */
export function FaqCard({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const ai = useFaqAi(productId)
  const canEdit = useCan("moderation")
  // null: closed; "new": adding one by hand; else the question opened
  const [opened, setOpened] = useState<QuestionRow | "new" | null>(null)
  const count = useQuery(productQuestionsQuery(productId)).data?.count ?? 0
  return (
    <SectionCard
      title={t("products.faq.title")}
      description={t("products.faq.description")}
      // Folded with the page's other seldom parts; a draft being written keeps it open
      collapse={{
        id: PRODUCT_SECTIONS.faq,
        name: "product.faq",
        summary: ai.open
          ? t("products.faq.summaryOpen")
          : count > 0
            ? t("products.faq.summaryCount", { count })
            : t("products.faq.summary"),
        attention: ai.open,
      }}
      action={
        canEdit || ai.shown ? (
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpened("new")
                }}
              >
                <Plus />
                {t("products.faq.addOne")}
              </Button>
            ) : null}
            {ai.shown ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={ai.open}
                onClick={() => {
                  if (ai.open) {
                    ai.close()
                  } else {
                    ai.start()
                  }
                }}
              >
                <Sparkles />
                {t("products.faq.draft")}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {ai.open ? <FaqDraft ai={ai} /> : null}
        <ProductQuestions productId={productId} onOpen={canEdit ? setOpened : null} />
        {ai.shown && !ai.open && count === 0 ? (
          <p className="text-sm text-muted-foreground">{t("products.faq.empty")}</p>
        ) : null}
      </div>
      {opened ? (
        <QuestionDialog
          key={opened === "new" ? "new" : opened.id}
          question={opened === "new" ? null : opened}
          productId={productId}
          onClose={() => {
            setOpened(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
