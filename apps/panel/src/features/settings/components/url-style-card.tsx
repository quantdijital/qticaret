import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { jobsQuery, useStartJob } from "@/features/settings/api/activity"
import { URL_STYLE_JOB, checkUrlStyle, jobQuery } from "@/features/settings/api/url-style"
import type { CategoryUrlStyle, StyleCheck, UrlStyles } from "@/features/settings/api/url-style"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { useJobsMessage } from "@/features/settings/use-jobs-message"

const ENTITIES = ["product", "category", "brand"] as const
type Entity = (typeof ENTITIES)[number]
// Each choice with the address it gives; a category's also carry a subcategory's
// tree, so the nested style (adr/0017 Ek 2026-11-23) reads apart from the flat one
const CHOICES: Readonly<Record<Entity, readonly { style: CategoryUrlStyle; example: string }[]>> = {
  product: [
    { style: "prefixed", example: "/urun/keten-gomlek" },
    { style: "flat", example: "/keten-gomlek" },
  ],
  category: [
    { style: "prefixed", example: "/kategori/hediyelik-esyalar/caki-kutusu" },
    { style: "nested", example: "/hediyelik-esyalar/caki-kutusu" },
    { style: "flat", example: "/caki-kutusu" },
  ],
  brand: [
    { style: "prefixed", example: "/marka/ornek-marka" },
    { style: "flat", example: "/ornek-marka" },
  ],
}
const SHOWN_CONFLICTS = 8

function Conflicts({ check }: { check: StyleCheck }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning-text">
      <p className="flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("settings.seo.style.conflicts", { count: check.conflicts.length })}
      </p>
      <ul className="flex flex-col gap-1 pl-6">
        {check.conflicts.slice(0, SHOWN_CONFLICTS).map((conflict) => (
          <li key={conflict.path}>
            <span className="font-mono">{conflict.path}</span>
            {" · "}
            {t(`settings.seo.style.reasons.${conflict.reason}`, {
              names: conflict.records.map((record) => record.name).join(", "),
            })}
            {conflict.holder?.status === "reserved" ? ` ${t("settings.seo.style.releasable")}` : ""}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The running move, if any: from this page's start or found among the shop's jobs. */
function useStyleJob() {
  const [started, setStarted] = useState<string | null>(null)
  const jobs = useQuery(jobsQuery(0))
  const running =
    jobs.data?.async_jobs.find(
      (job) => job.type === URL_STYLE_JOB && (job.status === "queued" || job.status === "running")
    )?.id ?? null
  const id = started ?? running
  const job = useQuery(jobQuery(id))
  return { id, job: job.data, start: setStarted }
}

/**
 * The URL style (docs/13 §2.2): changing it moves every page's address.
 * A check lists what stands in the way; the move runs as a job, old
 * addresses answer with a 301, and the style is saved once all moved.
 */
export function UrlStyleCard({ saved }: { saved: UrlStyles }) {
  const { t } = useTranslation()
  const jobs = useJobsMessage()
  const client = useQueryClient()
  const startJob = useStartJob()
  const [styles, setStyles] = useState<UrlStyles>(saved)
  const [check, setCheck] = useState<StyleCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { id, job, start } = useStyleJob()
  const changed = ENTITIES.some((entity) => styles[entity] !== saved[entity])
  const moving =
    id !== null && (job === undefined || job.status === "queued" || job.status === "running")

  // A finished move, said once: the settings now hold the new style
  const told = useRef(new Set<string>())
  useEffect(() => {
    if (!job || job.status === "queued" || job.status === "running" || told.current.has(job.id)) {
      return
    }
    told.current.add(job.id)
    if (job.status === "succeeded") {
      toast.success(
        t("settings.seo.style.moved", { count: Number(job.result_summary?.["moved"] ?? 0) })
      )
    } else {
      toast.error(t(jobs("settings.seo.style.failed")))
    }
    start(null)
    setCheck(null)
    void client.invalidateQueries({ queryKey: ["settings"] })
  }, [job, client, start, t, jobs])

  const runCheck = async () => {
    setChecking(true)
    try {
      setCheck(await checkUrlStyle(styles))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setChecking(false)
    }
  }
  const pick = (entity: Entity, style: CategoryUrlStyle) => {
    setStyles((current) => ({ ...current, [entity]: style }))
    setCheck(null)
  }

  return (
    <SectionCard title={t("settings.seo.style.title")} description={t("settings.seo.style.hint")}>
      <div className="flex flex-col gap-5">
        {ENTITIES.map((entity) => (
          <Field key={entity} label={t(`settings.seo.urlStyle.${entity}`)}>
            <RadioGroup
              value={styles[entity]}
              disabled={moving}
              onValueChange={(value) => {
                pick(entity, value as CategoryUrlStyle)
              }}
              className={cn(
                "grid gap-2",
                CHOICES[entity].length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"
              )}
            >
              {CHOICES[entity].map(({ style, example }) => (
                <label
                  key={style}
                  className="flex h-full cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem value={style} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] font-medium">
                      {t(
                        entity === "category"
                          ? `settings.seo.style.category.${style}`
                          : `settings.seo.style.option.${style}`
                      )}
                    </span>
                    <span className="font-mono text-xs break-all text-muted-foreground">
                      {example}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </Field>
        ))}
        {moving ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="flex items-center gap-2 text-[13px]">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("settings.seo.style.moving", { percent: job?.progress ?? 0 })}
            </p>
            <Progress
              value={job?.progress ?? 0}
              aria-label={t("settings.seo.style.moving", { percent: job?.progress ?? 0 })}
            />
          </div>
        ) : check ? (
          check.conflicts.length > 0 ? (
            <Conflicts check={check} />
          ) : (
            <p className="flex items-start gap-2 rounded-md bg-info-soft px-3 py-2.5 text-[13px] text-info-text">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("settings.seo.style.ready", {
                count: check.moves,
                pages: formatCount(check.moves),
              })}
            </p>
          )
        ) : null}
        {changed && !moving ? (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              variant="cancel"
              onClick={() => {
                setStyles(saved)
                setCheck(null)
              }}
            >
              {t("common.cancel")}
            </Button>
            {check?.conflicts.length === 0 ? (
              <Button
                disabled={startJob.isPending}
                onClick={() => {
                  setConfirming(true)
                }}
              >
                {t("settings.seo.style.move")}
              </Button>
            ) : (
              <Button disabled={checking} onClick={() => void runCheck()}>
                {checking ? <Loader2 className="animate-spin" /> : null}
                {t("settings.seo.style.check")}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("settings.seo.style.confirmTitle")}
        description={t("settings.seo.style.confirmText", { pages: formatCount(check?.moves ?? 0) })}
        confirmLabel={t("settings.seo.style.move")}
        onConfirm={() => {
          setConfirming(false)
          startJob.mutate(
            { type: URL_STYLE_JOB, input: { ...styles } },
            {
              onSuccess: ({ async_job }) => {
                start(async_job.id)
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      />
    </SectionCard>
  )
}
