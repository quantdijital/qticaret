import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  GUIDANCE_LIMITS,
  GUIDANCE_TASKS,
  overLimit,
  useSaveAiGuidance,
} from "@/features/ai/api/guidance"
import type { AiGuidanceSettings, AiTaskGuidance, GuidanceTask } from "@/features/ai/api/guidance"
import { GuidanceText } from "@/features/settings/components/ai-guidance-text"
import { errorText } from "@/lib/errors"

const C = "ai.guidance.tasks"

interface TaskDraft {
  extra: string
  examples: string[]
}
type Draft = Record<GuidanceTask, TaskDraft>

const draftOf = (saved: AiGuidanceSettings): Draft =>
  Object.fromEntries(
    GUIDANCE_TASKS.map((task) => {
      const entry = saved.tasks[task]
      return [task, { extra: entry?.extra ?? "", examples: entry?.examples ?? [] }]
    })
  ) as Draft

const sent = (draft: TaskDraft): AiTaskGuidance => ({
  extra: draft.extra.trim() || null,
  examples: draft.examples.map((each) => each.trim()).filter(Boolean),
})

/** Every task's guidance as a save sends it: an emptied one empty, which clears it. */
const tasksOf = (draft: Draft): Record<string, AiTaskGuidance> =>
  Object.fromEntries(GUIDANCE_TASKS.map((task) => [task, sent(draft[task])]))

const overAny = (draft: Draft) =>
  GUIDANCE_TASKS.some(
    (task) =>
      overLimit(draft[task].extra, GUIDANCE_LIMITS.extra) ||
      draft[task].examples.some((each) => overLimit(each, GUIDANCE_LIMITS.example))
  )

/**
 * Settings › Yapay zekâ › Yazım yönergesi › İşlere göre (adr/0074 §2):
 * every text task a closed row (its name and what is set), opened for an
 * extra note and up to three example texts. One save for all; a task
 * emptied is sent empty, which clears it on the server.
 */
export function AiGuidanceTasksCard({
  saved,
  mayChange,
  onDraft,
}: {
  saved: AiGuidanceSettings
  mayChange: boolean
  /** The tasks' guidance as it stands, saved or not (for "Dene"). */
  onDraft?: ((tasks: AiGuidanceSettings["tasks"]) => void) | undefined
}) {
  const { t } = useTranslation()
  const save = useSaveAiGuidance()
  const [draft, setDraft] = useState(() => draftOf(saved))
  const [base, setBase] = useState(saved)
  if (base !== saved) {
    setBase(saved)
    if (JSON.stringify(draft) === JSON.stringify(draftOf(base))) {
      setDraft(draftOf(saved))
    }
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(saved))
  useEffect(() => {
    onDraft?.(tasksOf(draft))
  }, [draft, onDraft])
  const off = !mayChange || save.isPending
  const change = (task: GuidanceTask, next: Partial<TaskDraft>) => {
    setDraft((current) => ({ ...current, [task]: { ...current[task], ...next } }))
  }

  const submit = () => {
    if (overAny(draft)) {
      return
    }
    save.mutate(
      { tasks: tasksOf(draft) },
      {
        onSuccess: (result) => {
          setDraft(draftOf(result.values))
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  const summaryOf = (task: TaskDraft) => {
    const parts = [
      task.extra.trim() ? t(`${C}.hasExtra`) : null,
      task.examples.length ? t(`${C}.examplesCount`, { count: task.examples.length }) : null,
    ].filter(Boolean)
    return parts.length ? parts.join(" · ") : t(`${C}.none`)
  }

  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      dirty={dirty}
      saving={save.isPending}
      onSubmit={submit}
      onReset={() => {
        setDraft(draftOf(saved))
      }}
    >
      <div className="flex flex-col divide-y rounded-md border">
        {GUIDANCE_TASKS.map((task) => {
          const value = draft[task]
          return (
            <details key={task} className="group px-3 py-2.5">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                />
                <span className="font-medium">{t(`ai.tasks.${task}`)}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {summaryOf(value)}
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-4 pl-6">
                <GuidanceText
                  label={t(`${C}.extra`)}
                  value={value.extra}
                  max={GUIDANCE_LIMITS.extra}
                  rows={2}
                  placeholder={t(`${C}.extraPlaceholder`)}
                  disabled={off}
                  onChange={(extra) => {
                    change(task, { extra })
                  }}
                />
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-sm font-medium">{t(`${C}.examples`)}</legend>
                  <p className="text-xs text-muted-foreground">
                    {t(`${C}.examplesHint`, {
                      max: GUIDANCE_LIMITS.examples,
                      length: GUIDANCE_LIMITS.example,
                    })}
                  </p>
                  {value.examples.map((example, at) => (
                    <div key={at} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <GuidanceText
                          label={t(`${C}.example`, { n: at + 1 })}
                          value={example}
                          max={GUIDANCE_LIMITS.example}
                          rows={3}
                          disabled={off}
                          onChange={(next) => {
                            change(task, {
                              examples: value.examples.map((each, i) => (i === at ? next : each)),
                            })
                          }}
                        />
                      </div>
                      {mayChange ? (
                        <Button
                          type="button"
                          disabled={save.isPending}
                          variant="ghost"
                          size="icon-sm"
                          className="mt-6"
                          aria-label={t(`${C}.removeExample`, { n: at + 1 })}
                          onClick={() => {
                            change(task, { examples: value.examples.filter((_, i) => i !== at) })
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {mayChange && value.examples.length < GUIDANCE_LIMITS.examples ? (
                    <Button
                      type="button"
                      disabled={save.isPending}
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        change(task, { examples: [...value.examples, ""] })
                      }}
                    >
                      <Plus />
                      {t(`${C}.addExample`)}
                    </Button>
                  ) : null}
                </fieldset>
              </div>
            </details>
          )
        })}
      </div>
    </CardForm>
  )
}
