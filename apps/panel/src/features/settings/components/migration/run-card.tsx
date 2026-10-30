import { useQuery } from "@tanstack/react-query"
import { FlaskConical, Loader2, Play } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { migrationJobQuery, useStartMigration } from "@/features/settings/api/migration"
import type { MigrationMode, MigrationSourceKind, Parcel } from "@/features/settings/api/migration"
import { RunResult } from "@/features/settings/components/migration/run-result"
import { RecentRuns } from "@/features/settings/components/migration/runs-card"
import { ShopifyConnection } from "@/features/settings/components/migration/shopify-connection"
import { errorText } from "@/lib/errors"

const R = "settings.migration.run"
const SOURCES: readonly MigrationSourceKind[] = ["shopify", "feed", "customers", "bundle"]
const PARCEL_FIELDS = ["weight", "length", "width", "height"] as const
// Sources that bring products, and so may need a parcel
const WITH_PRODUCTS = new Set<MigrationSourceKind>(["shopify", "feed", "bundle"])
const ACCEPT: Partial<Record<MigrationSourceKind, string>> = {
  customers: ".xlsx,.csv",
  bundle: ".json,application/json",
}

/** The four numbers, or null: all of them, positive, or none at all. */
function parcelOf(values: Record<(typeof PARCEL_FIELDS)[number], string>): Parcel | null {
  const numbers = PARCEL_FIELDS.map((field) => Number(values[field].replace(",", ".")))
  return numbers.every((value) => Number.isFinite(value) && value > 0)
    ? {
        weight: numbers[0] ?? 0,
        length: numbers[1] ?? 0,
        width: numbers[2] ?? 0,
        height: numbers[3] ?? 0,
      }
    : null
}

/**
 * The migration's source and its run (F14, adr/0042 §9): the source chosen,
 * what it needs (a connected store, a feed's address, a file), the owner's
 * parcel for products without measurements; a check first, then applying,
 * which is confirmed and proved again. The run's counts and report follow.
 */
export function RunCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const start = useStartMigration()
  const [kind, setKind] = useState<MigrationSourceKind>("shopify")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [parcel, setParcel] = useState({ weight: "", length: "", width: "", height: "" })
  const [jobId, setJobId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const job = useQuery(migrationJobQuery(jobId))
  const running = job.data?.status === "queued" || job.data?.status === "running"
  const ready =
    kind === "feed"
      ? url.trim() !== ""
      : kind === "customers" || kind === "bundle"
        ? file !== null
        : true
  const run = (mode: MigrationMode) => {
    start.mutate(
      {
        kind,
        mode,
        parcel: WITH_PRODUCTS.has(kind) ? parcelOf(parcel) : null,
        file,
        url: url.trim(),
      },
      {
        onSuccess: (started) => {
          setJobId(started.id)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <SectionCard
      title={t(`${R}.title`)}
      description={t(`${R}.description`)}
      {...(className ? { className } : {})}
    >
      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Field label={t(`${R}.source`)} htmlFor="migration-source" hint={t(`${R}.hints.${kind}`)}>
            <Select
              value={kind}
              onValueChange={(next) => {
                setKind(next as MigrationSourceKind)
                setFile(null)
                setJobId(null)
              }}
            >
              <SelectTrigger id="migration-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {t(`${R}.sources.${source}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {kind === "shopify" ? <ShopifyConnection /> : null}
          {kind === "feed" ? (
            <Field label={t(`${R}.feedUrl`)} htmlFor="migration-feed">
              <Input
                id="migration-feed"
                type="url"
                inputMode="url"
                placeholder="https://eski-magaza.com/xml/google.xml"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                }}
              />
            </Field>
          ) : null}
          {kind === "customers" || kind === "bundle" ? (
            <Field label={t(`${R}.file`)} htmlFor="migration-file">
              <Input
                id="migration-file"
                type="file"
                accept={ACCEPT[kind]}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                }}
              />
            </Field>
          ) : null}
          {WITH_PRODUCTS.has(kind) ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t(`${R}.parcel.title`)}</legend>
              <p className="text-[13px] text-muted-foreground">{t(`${R}.parcel.hint`)}</p>
              <div className="grid grid-cols-2 gap-3">
                {PARCEL_FIELDS.map((field) => (
                  <Field key={field} label={t(`${R}.parcel.${field}`)} htmlFor={`parcel-${field}`}>
                    <Input
                      id={`parcel-${field}`}
                      inputMode="decimal"
                      value={parcel[field]}
                      onChange={(event) => {
                        setParcel({ ...parcel, [field]: event.target.value })
                      }}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={!ready || running || start.isPending}
              onClick={() => {
                run("check")
              }}
            >
              {start.isPending && !confirming ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FlaskConical />
              )}
              {t(`${R}.check`)}
            </Button>
            <Button
              disabled={!ready || running || start.isPending}
              onClick={() => {
                setConfirming(true)
              }}
            >
              <Play />
              {t(`${R}.apply`)}
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 rounded-md border bg-muted/30 p-4">
          {job.data ? <RunResult job={job.data} /> : null}
          <RecentRuns />
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${R}.confirmTitle`)}
        description={t(`${R}.confirmText`)}
        confirmLabel={t(`${R}.apply`)}
        onConfirm={() => {
          setConfirming(false)
          run("apply")
        }}
      />
    </SectionCard>
  )
}
