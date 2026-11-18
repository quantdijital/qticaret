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
import { aiServicesQuery } from "@/features/ai/api/ai"
import { acceptSuggestion, dismissSuggestion } from "@/features/ai/api/suggestions"
import {
  ALT_REVIEW_KEY,
  ALT_TEXT_TASK,
  imagesMissingAlt,
  openAltSuggestionsQuery,
  saveAlt,
  startAltJob,
} from "@/features/media/api/alt-review"
import type { OpenAltSuggestion } from "@/features/media/api/alt-review"
import { MEDIA_KEY } from "@/features/media/api/media"
import { AltReviewRow } from "@/features/media/components/alt-review-row"
import { AltReviewStart } from "@/features/media/components/alt-review-start"
import { sheetJobQuery } from "@/features/products/api/sheets"
import { errorText } from "@/lib/errors"

const R = "ai.altReview"

export interface AltReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Alt text suggestions for the library in bulk (docs/22 "Aşama 5", PR
 * 5-2), as Shopify's: one button asks for the images with no alt text, and
 * each suggestion waits here with its picture. Kullan saves the field's
 * text to the image and marks the suggestion accepted; Vazgeç dismisses
 * it; "Tümünü kullan" does Kullan for each in turn. This list is the
 * review adr/0005 asks for: nothing reaches an image without a click here.
 */
export function AltReviewDialog({ open, onOpenChange }: AltReviewDialogProps) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === ALT_TEXT_TASK)
  const usable = view?.usable ?? []
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")

  const [jobId, setJobId] = useState<string | null>(null)
  const job = useQuery(sheetJobQuery(jobId)).data
  const running = job?.status === "queued" || job?.status === "running"
  const list = useQuery({
    ...openAltSuggestionsQuery(),
    enabled: open,
    // Each suggestion shows as the job makes it
    refetchInterval: running ? 2000 : false,
  })
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [starting, setStarting] = useState(false)
  const [all, setAll] = useState(false)

  // Once the job ends, its last suggestions are read
  useEffect(() => {
    if (job && !running) {
      void client.invalidateQueries({ queryKey: ALT_REVIEW_KEY })
    }
  }, [client, job, running])

  const suggestions = list.data ?? []
  const textOf = (each: OpenAltSuggestion) => edits[each.id] ?? each.text
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
  const refresh = () => client.invalidateQueries({ queryKey: MEDIA_KEY })

  // Saved first: a suggestion is marked accepted only once its text is on the image
  const applyOne = async (each: OpenAltSuggestion): Promise<boolean> => {
    mark(each.id, true)
    try {
      await saveAlt(each.media.id, textOf(each).trim())
      await acceptSuggestion(each.id)
      return true
    } catch (failure) {
      toast.error(
        t(`${R}.saveFailed`, { name: each.media.filename, reason: errorText(t, failure) })
      )
      return false
    } finally {
      mark(each.id, false)
    }
  }

  const applySingle = async (each: OpenAltSuggestion) => {
    if (await applyOne(each)) {
      toast.success(t(`${R}.saved`, { name: each.media.filename }))
    }
    await refresh()
  }

  const dismissOne = async (each: OpenAltSuggestion) => {
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
      const ids = await imagesMissingAlt(new Set(suggestions.map((each) => each.media.id)))
      if (ids.length === 0) {
        toast.info(t(`${R}.nothingMissing`))
        return
      }
      setJobId((await startAltJob(ids, usable.length > 1 ? service : undefined)).id)
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
            <AltReviewStart
              usable={usable}
              service={service}
              onService={setPicked}
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
                    <AltReviewRow
                      key={each.id}
                      suggestion={each}
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
