import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Button } from "@qticaret/admin-ui/ui/button"
import { craftsQuery } from "@/features/ai/api/crafts"
import type { DefaultCraft } from "@/features/ai/api/crafts"
import {
  GUIDANCE_LIMITS,
  GUIDANCE_TASKS,
  overLimit,
  useSaveAiGuidance,
} from "@/features/ai/api/guidance"
import type { AiGuidanceSettings, AiTaskGuidance, GuidanceTask } from "@/features/ai/api/guidance"
import { useStaff } from "@/features/auth/api/staff"
import { AiGuidanceCraft } from "@/features/settings/components/ai-guidance-craft"
import { GuidanceText } from "@/features/settings/components/ai-guidance-text"
import { errorText } from "@/lib/errors"

const C = "ai.guidance.tasks"

interface TaskDraft {
  extra: string
  examples: string[]
  /** The owner's own instruction; null: the default. */
  craft: string | null
  /** Keep one's own instruction over a new default (sends the new default's version). */
  keepBase: boolean
}
type Draft = Record<GuidanceTask, TaskDraft>

const draftOf = (saved: AiGuidanceSettings): Draft =>
  Object.fromEntries(
    GUIDANCE_TASKS.map((task) => {
      const entry = saved.tasks[task]
      return [
        task,
        {
          extra: entry?.extra ?? "",
          examples: entry?.examples ?? [],
          craft: entry?.craft ?? null,
          keepBase: false,
        },
      ]
    })
  ) as Draft

/** What a save (or "Dene") sends of a task's instruction: the owner's only, and only a change. */
interface CraftContext {
  owner: boolean
  saved: AiGuidanceSettings
  defaults: readonly DefaultCraft[]
}

function sent(task: GuidanceTask, draft: TaskDraft, context: CraftContext): AiTaskGuidance {
  const entry: AiTaskGuidance = {
    extra: draft.extra.trim() || null,
    examples: draft.examples.map((each) => each.trim()).filter(Boolean),
  }
  if (!context.owner) {
    return entry
  }
  // Left out, the server keeps the stored one: sent only when it changed
  if (draft.craft !== (context.saved.tasks[task]?.craft ?? null)) {
    entry.craft = draft.craft
  }
  const standard = context.defaults.find((each) => each.task === task)
  if (draft.keepBase && standard) {
    entry.craft_base = standard.version
  }
  return entry
}

/** Every task's guidance as a save sends it: an emptied one empty, which clears it. */
const tasksOf = (draft: Draft, context: CraftContext): Record<string, AiTaskGuidance> =>
  Object.fromEntries(GUIDANCE_TASKS.map((task) => [task, sent(task, draft[task], context)]))

const overAny = (draft: Draft) =>
  GUIDANCE_TASKS.some(
    (task) =>
      overLimit(draft[task].extra, GUIDANCE_LIMITS.extra) ||
      overLimit(draft[task].craft ?? "", GUIDANCE_LIMITS.craft) ||
      draft[task].examples.some((each) => overLimit(each, GUIDANCE_LIMITS.example))
  )

/**
 * Settings › Yapay zekâ › Yazım yönergesi › İşlere göre (adr/0074 §2, §3):
 * every text task a closed row (its name and what is set), opened for an
 * extra note and up to three example texts, and for the owner a closed
 * "Gelişmiş" part with the task's own instruction. One save for all; a
 * task emptied is sent empty, which clears it on the server; an
 * instruction is sent by the owner only, and only when it changed (left
 * out, the server keeps it).
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
  const owner = useStaff()?.role === "owner"
  const crafts = useQuery({ ...craftsQuery(), enabled: owner })
  const defaults = crafts.data ?? []
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
    onDraft?.(tasksOf(draft, { owner, saved, defaults: crafts.data ?? [] }))
  }, [draft, onDraft, owner, saved, crafts.data])
  const off = !mayChange || save.isPending
  const change = (task: GuidanceTask, next: Partial<TaskDraft>) => {
    setDraft((current) => ({ ...current, [task]: { ...current[task], ...next } }))
  }

  const submit = () => {
    if (overAny(draft)) {
      return
    }
    save.mutate(
      { tasks: tasksOf(draft, { owner, saved, defaults }) },
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
      task.craft !== null ? t(`${C}.hasCraft`) : null,
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
                {owner ? (
                  <AiGuidanceCraft
                    standard={defaults.find((each) => each.task === task)}
                    saved={saved.tasks[task]}
                    value={value.craft}
                    kept={value.keepBase}
                    disabled={off}
                    onChange={(craft) => {
                      change(task, { craft })
                    }}
                    onKeep={() => {
                      change(task, { keepBase: true })
                    }}
                  />
                ) : null}
              </div>
            </details>
          )
        })}
      </div>
    </CardForm>
  )
}
