import { useMutation } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { PREVIEW_TASKS, previewGuidance } from "@/features/ai/api/guidance"
import type {
  AiGuidanceSettings,
  GuidancePreview,
  PreviewSide,
  PreviewTask,
} from "@/features/ai/api/guidance"
import { aiFailureText } from "@/features/ai/failure-text"
import { searchProducts } from "@/features/promotions/api/scope-options"

const C = "ai.guidance.try"

/** One side's candidates, or why none passed the gate. */
function Side({ title, side }: { title: string; side: PreviewSide }) {
  const { t } = useTranslation()
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {side.status === "succeeded" && side.candidates.length > 0 ? (
        <ol className="flex flex-col gap-2 text-sm">
          {side.candidates.map((candidate) => (
            <li key={candidate} className="break-words whitespace-pre-line">
              {candidate}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${C}.refused`)}</p>
      )}
    </section>
  )
}

/**
 * "Dene" on Settings › Yapay zekâ › Yazım yönergesi (adr/0074 §2): one
 * product and one task, two suggestions side by side, without the shop's
 * guidance and with the guidance as the cards above hold it (saved or
 * not). Each try is two AI operations against the quota; nothing is kept
 * or written to the product. Owner and admin (`mayChange`).
 */
export function AiGuidanceTry({
  guidance,
  mayChange,
}: {
  guidance: AiGuidanceSettings
  mayChange: boolean
}) {
  const { t } = useTranslation()
  const productId = useId()
  const taskId = useId()
  const [product, setProduct] = useState<PickerOption | null>(null)
  const [task, setTask] = useState<PreviewTask>("seo_title")
  const run = useMutation<GuidancePreview>({
    mutationFn: () => previewGuidance({ task, productId: product?.id ?? "", guidance }),
  })
  const off = !mayChange || run.isPending

  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] md:items-end">
          <Field label={t(`${C}.product`)} htmlFor={productId}>
            <SearchPicker
              id={productId}
              value={product}
              onChange={(next) => {
                setProduct(next)
                run.reset()
              }}
              search={searchProducts}
              queryKey={["ai", "guidance-try", "products"]}
              placeholder={t(`${C}.productPlaceholder`)}
              empty={t(`${C}.noProducts`)}
              disabled={off}
              className="w-full max-w-none"
            />
          </Field>
          <Field label={t(`${C}.task`)} htmlFor={taskId}>
            <Select
              value={task}
              disabled={off}
              onValueChange={(next) => {
                setTask(next as PreviewTask)
                run.reset()
              }}
            >
              <SelectTrigger id={taskId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREVIEW_TASKS.map((each) => (
                  <SelectItem key={each} value={each}>
                    {t(`ai.tasks.${each}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            type="button"
            disabled={off || product === null}
            onClick={() => {
              run.mutate()
            }}
          >
            <Sparkles aria-hidden="true" />
            {run.isPending ? t(`${C}.running`) : t(`${C}.run`)}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t(`${C}.cost`)}</p>
        {run.isError ? (
          <p role="alert" className="text-sm text-destructive-text">
            {aiFailureText(t, run.error, null)}
          </p>
        ) : null}
        {run.data ? (
          <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
            <Side title={t(`${C}.plain`)} side={run.data.plain} />
            <Side title={t(`${C}.guided`)} side={run.data.guided} />
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}
