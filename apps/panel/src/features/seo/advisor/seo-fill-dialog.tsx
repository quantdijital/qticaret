import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { acceptSuggestion, dismissSuggestion } from "@/features/ai/api/suggestions"
import {
  SEO_FILL_KEY,
  openSeoSuggestionsQuery,
  saveSeoText,
  seoFillCountQuery,
  startSeoFill,
} from "@/features/seo/api/seo-fill"
import type { OpenSeoSuggestion, SeoFillScope } from "@/features/seo/api/seo-fill"
import { SeoFillRow } from "@/features/seo/advisor/seo-fill-row"
import { SeoFillStart } from "@/features/seo/advisor/seo-fill-start"
import { sheetJobQuery } from "@/features/products/api/sheets"
import { errorText } from "@/lib/errors"

const R = "seo.aiFill"

export interface SeoFillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The services that can write a search title, and the one remembered. */
  usable: readonly string[]
  remembered: string | null
}

/**
 * The search texts the advisor flags, filled in bulk (adr/0074 §5 madde
 * 7): one button queues the job, and each suggestion waits here with its
 * page and the field's text now. Kullan saves the field through the
 * page's own SEO save and marks the candidate taken; Vazgeç dismisses it;
 * "Tümünü kullan" does Kullan for each in turn. Nothing reaches a page
 * without a click here (adr/0005).
 */
export function SeoFillDialog({ open, onOpenChange, usable, remembered }: SeoFillDialogProps) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const [scope, setScope] = useState<SeoFillScope>("both")

  const [jobId, setJobId] = useState<string | null>(null)
  const job = useQuery(sheetJobQuery(jobId)).data
  const running = job?.status === "queued" || job?.status === "running"
  const count = useQuery({ ...seoFillCountQuery(), enabled: open })
  const list = useQuery({
    ...openSeoSuggestionsQuery(),
    enabled: open,
    // Each suggestion shows as the job makes it
    refetchInterval: running ? 2000 : false,
  })
  const [choices, setChoices] = useState<Record<string, number>>({})
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [starting, setStarting] = useState(false)
  const [all, setAll] = useState(false)

  // Once the job ends, its last suggestions and the new count are read
  useEffect(() => {
    if (job && !running) {
      void client.invalidateQueries({ queryKey: SEO_FILL_KEY })
    }
  }, [client, job, running])

  const suggestions = list.data ?? []
  const choiceOf = (each: OpenSeoSuggestion) => choices[each.id] ?? 0
  const textOf = (each: OpenSeoSuggestion) =>
    edits[each.id] ?? each.candidates[choiceOf(each)] ?? ""
  const mark = (id: string, on: boolean) => {
    setBusy((previous) => {
      const next = new Set(previous)
      if (on) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }
  const refresh = () => client.invalidateQueries({ queryKey: SEO_FILL_KEY })

  // Saved first: a suggestion is marked accepted only once its text is on the page
  const applyOne = async (each: OpenSeoSuggestion): Promise<boolean> => {
    const { type, id, name } = each.entity
    mark(each.id, true)
    try {
      await saveSeoText(type, id, each.task, textOf(each).trim())
      await acceptSuggestion(each.id, choiceOf(each))
      void client.invalidateQueries({ queryKey: ["seo-meta", type, id] })
      void client.invalidateQueries({ queryKey: ["seo", "assessment", type, id] })
      return true
    } catch (failure) {
      toast.error(t(`${R}.saveFailed`, { name, reason: errorText(t, failure) }))
      return false
    } finally {
      mark(each.id, false)
    }
  }

  const applySingle = async (each: OpenSeoSuggestion) => {
    if (await applyOne(each)) {
      toast.success(t(`${R}.saved`, { name: each.entity.name }))
    }
    await refresh()
  }

  const dismissOne = async (each: OpenSeoSuggestion) => {
    mark(each.id, true)
    try {
      await dismissSuggestion(each.id)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      mark(each.id, false)
    }
    await refresh()
  }

  const applyAll = async () => {
    setAll(true)
    let saved = 0
    for (const each of suggestions.filter((one) => textOf(one).trim() !== "")) {
      if (await applyOne(each)) {
        saved += 1
      }
    }
    setAll(false)
    if (saved > 0) {
      toast.success(t(`${R}.savedAll`, { count: saved }))
    }
    await refresh()
  }

  const start = async () => {
    setStarting(true)
    try {
      setJobId(await startSeoFill(scope, usable.length > 1 ? service : undefined))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setStarting(false)
    }
  }

  const onClose = (next: boolean) => {
    if (!next && running) {
      // The job goes on on the server; Settings > Jobs shows where it stands
      toast.info(t(`${R}.background`))
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {open ? (
        <DialogContent size="lg" pane>
          <DialogHeader>
            <DialogTitle>{t(`${R}.title`)}</DialogTitle>
            <DialogDescription>{t(`${R}.description`)}</DialogDescription>
          </DialogHeader>
          <DialogBody list className="flex flex-col gap-4">
            <SeoFillStart
              usable={usable}
              service={service}
              onService={setPicked}
              scope={scope}
              onScope={setScope}
              count={count.data}
              job={job}
              starting={starting}
              onStart={() => void start()}
            />
            {list.isError ? (
              <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
            ) : list.isPending ? (
              <Skeleton className="h-24 w-full" aria-label={t("common.loading")} />
            ) : suggestions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t(`${R}.empty`)}</p>
            ) : (
              <section aria-label={t(`${R}.listLabel`)} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t(`${R}.waiting`, { count: suggestions.length })}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={all || busy.size > 0}
                    onClick={() => void applyAll()}
                  >
                    {t(`${R}.useAll`)}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t(`${R}.note`)}</p>
                <ul className="flex flex-col divide-y">
                  {suggestions.map((each) => (
                    <SeoFillRow
                      key={each.id}
                      suggestion={each}
                      picked={choiceOf(each)}
                      onPick={(index) => {
                        setChoices((previous) => ({ ...previous, [each.id]: index }))
                        // A candidate picked replaces what was typed over the last one
                        setEdits((previous) =>
                          Object.fromEntries(
                            Object.entries(previous).filter(([id]) => id !== each.id)
                          )
                        )
                      }}
                      text={textOf(each)}
                      busy={all || busy.has(each.id)}
                      onText={(text) => {
                        setEdits((previous) => ({ ...previous, [each.id]: text }))
                      }}
                      onUse={() => void applySingle(each)}
                      onDismiss={() => void dismissOne(each)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
