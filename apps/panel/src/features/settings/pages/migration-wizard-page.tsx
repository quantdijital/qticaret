import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, Check, Loader2, Play } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Wizard } from "@qticaret/admin-ui/patterns/wizard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { migrationJobQuery, useStartMigration } from "@/features/settings/api/migration"
import type { StartMigration } from "@/features/settings/api/migration"
import type { RunKindName } from "@/features/settings/api/migration-overview"
import { FileStep } from "@/features/settings/components/migration/wizard/file-step"
import { kindsFound } from "@/features/settings/components/migration/wizard/kinds"
import { KindsStep } from "@/features/settings/components/migration/wizard/kinds-step"
import { ResultStep } from "@/features/settings/components/migration/wizard/result-step"
import { SourceStep } from "@/features/settings/components/migration/wizard/source-step"
import {
  WIZARD_STEPS,
  draftProblem,
  emptyDraft,
  startOf,
} from "@/features/settings/components/migration/wizard/state"
import type { WizardDraft } from "@/features/settings/components/migration/wizard/state"
import { TransferStep } from "@/features/settings/components/migration/wizard/transfer-step"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/settings/migration/new")
const W = "settings.migration.wizard"
const [SOURCE, FILE, KINDS, TRANSFER, RESULT] = [0, 1, 2, 3, 4] as const

/**
 * A new migration in five steps (adr/0042 Ek 2026-11-27, docs/18 §7
 * Wizard): the source; its file or connection ("İncele" sends it for a
 * preview at once, nothing saved); what to move, with the preview's
 * counts; the transfer, kind by kind; the result with its fixes. The
 * file stays in the page and is sent again to apply (each job deletes
 * its copy). `?is=<job>` opens a finished transfer's result.
 */
export function MigrationWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { kaynak, is } = route.useSearch()
  const [at, setAt] = useState<number>(is ? RESULT : SOURCE)
  const [reached, setReached] = useState<number>(is ? RESULT : SOURCE)
  const [draft, setDraft] = useState<WizardDraft>(() =>
    emptyDraft(kaynak === "paket" ? "bundle" : "wordpress")
  )
  const [problem, setProblem] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(is ?? null)
  // The owner's ticks; none yet: everything the preview found
  const [ticked, setTicked] = useState<Set<RunKindName> | null>(null)
  const start = useStartMigration()
  const preview = useQuery(migrationJobQuery(previewId))
  const run = useQuery(migrationJobQuery(runId))
  const go = (step: number) => {
    setAt(step)
    setReached((was) => Math.max(was, step))
  }
  const previewDone = preview.data?.status === "succeeded"
  const chosen = ticked ?? new Set(kindsFound(preview.data))
  // The transfer ended: its result
  const runDone = run.data?.status === "succeeded"
  const current = at === TRANSFER && runDone ? RESULT : at
  const send = (input: StartMigration, done: (id: string) => void) => {
    start.mutate(input, {
      onSuccess: (job) => {
        done(job.id)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const review = () => {
    const found = draftProblem(draft)
    setProblem(found)
    if (!found) {
      send(startOf(draft, "check"), (id) => {
        setPreviewId(id)
        setTicked(null)
        go(KINDS)
      })
    }
  }
  const transfer = () => {
    send(startOf(draft, "apply", [...chosen]), (id) => {
      setRunId(id)
      // Once moving, the steps before it are done with: no going back to send twice
      setReached(TRANSFER)
      go(TRANSFER)
    })
  }
  const steps = WIZARD_STEPS.map((key) => ({
    key,
    title: t(`${W}.steps.${key}.title`),
    description: t(`${W}.steps.${key}.description`),
  }))
  const locked = current >= TRANSFER
  const back = current > SOURCE && !locked
  const footer = (
    <>
      {back ? (
        <Button
          variant="outline"
          onClick={() => {
            setAt(current - 1)
          }}
        >
          <ArrowLeft />
          {t(`${W}.back`)}
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link to="/settings/migration">
            {t(current === RESULT ? `${W}.done` : `${W}.cancel`)}
          </Link>
        </Button>
      )}
      {current === SOURCE ? (
        <Button
          onClick={() => {
            setProblem(null)
            go(FILE)
          }}
        >
          {t(`${W}.next`)}
          <ArrowRight />
        </Button>
      ) : current === FILE ? (
        <Button disabled={start.isPending} onClick={review}>
          {start.isPending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          {t(`${W}.review`)}
        </Button>
      ) : current === KINDS ? (
        <Button disabled={!previewDone || chosen.size === 0 || start.isPending} onClick={transfer}>
          {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
          {t(`${W}.start`)}
        </Button>
      ) : current === TRANSFER ? (
        <Button
          variant="outline"
          onClick={() => {
            void navigate({ to: "/settings/migration" })
          }}
        >
          {t(`${W}.background`)}
        </Button>
      ) : (
        <Button asChild>
          <Link to="/settings/migration">
            <Check />
            {t(`${W}.done`)}
          </Link>
        </Button>
      )}
    </>
  )
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t(`${W}.title`)}
        description={t(`${W}.subtitle`)}
        back={{ to: "/settings/migration", label: t("settings.migration.title") }}
      />
      <Wizard
        steps={steps}
        current={current}
        reached={locked ? current : reached}
        onStepSelect={(index) => {
          if (!locked) {
            setAt(index)
          }
        }}
        footer={footer}
      >
        {current === SOURCE ? (
          <SourceStep
            value={draft.source}
            withBundle={kaynak === "paket"}
            onChange={(source) => {
              setDraft({ ...emptyDraft(source), parcel: draft.parcel })
              setPreviewId(null)
              setReached(SOURCE)
            }}
          />
        ) : current === FILE ? (
          <FileStep
            draft={draft}
            problem={problem}
            onChange={(next) => {
              setDraft(next)
              setProblem(null)
            }}
          />
        ) : current === KINDS ? (
          <KindsStep job={preview.data} chosen={chosen} onChange={setTicked} />
        ) : current === TRANSFER ? (
          <TransferStep job={run.data} kinds={[...chosen]} />
        ) : run.data?.status === "succeeded" ? (
          <ResultStep job={run.data} file={draft.file} />
        ) : (
          <TransferStep job={run.data} kinds={[...chosen]} />
        )}
      </Wizard>
    </div>
  )
}
