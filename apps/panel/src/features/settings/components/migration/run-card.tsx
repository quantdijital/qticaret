import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { migrationJobQuery, useStartMigration } from "@/features/settings/api/migration"
import type {
  MigrationMode,
  MigrationSourceKind,
  StartMigration,
} from "@/features/settings/api/migration"
import type { WordpressRefresh } from "@/features/settings/api/migration-wordpress"
import { NO_PARCEL, readParcel } from "@/features/settings/components/migration/parcel"
import type { ParcelText } from "@/features/settings/components/migration/parcel"
import { ParcelFields, RunButtons } from "@/features/settings/components/migration/run-controls"
import { RunResult } from "@/features/settings/components/migration/run-result"
import { RecentRuns } from "@/features/settings/components/migration/runs-card"
import { ShopifyConnection } from "@/features/settings/components/migration/shopify-connection"
import { WordpressSource } from "@/features/settings/components/migration/wordpress-source"
import { errorText } from "@/lib/errors"

const R = "settings.migration.run"
const SOURCES: readonly MigrationSourceKind[] = [
  "shopify",
  "wordpress",
  "feed",
  "customers",
  "bundle",
]
// Sources that bring products, and so may need a parcel (WordPress asks for its own)
const WITH_PRODUCTS = new Set<MigrationSourceKind>(["shopify", "feed", "bundle"])
const ACCEPT: Partial<Record<MigrationSourceKind, string>> = {
  customers: ".xlsx,.csv",
  bundle: ".json,application/json",
}

/**
 * The migration's source and its run (F14, adr/0042 §9): the source chosen,
 * what it needs (a connected store, a feed's address, a file, a WordPress
 * export with its options), the owner's parcel for products without
 * measurements; a check first, then applying, which is confirmed and
 * proved again. The run's counts and report follow.
 */
export function RunCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const start = useStartMigration()
  const [kind, setKind] = useState<MigrationSourceKind>("shopify")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [parcel, setParcel] = useState<ParcelText>(NO_PARCEL)
  const [jobId, setJobId] = useState<string | null>(null)
  // A run to apply, waiting for the owner's word
  const [applying, setApplying] = useState<StartMigration | null>(null)
  // Kept while the dialog closes, so its words do not change on the way out
  const [refreshAsked, setRefreshAsked] = useState<WordpressRefresh | null>(null)
  const job = useQuery(migrationJobQuery(jobId))
  const running = job.data?.status === "queued" || job.data?.status === "running"
  const busy = running || start.isPending
  const pending = start.isPending ? start.variables.mode : null
  const ready =
    kind === "feed"
      ? url.trim() !== ""
      : kind === "customers" || kind === "bundle"
        ? file !== null
        : true
  const go = (input: StartMigration) => {
    start.mutate(input, {
      onSuccess: (started) => {
        setJobId(started.id)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const request = (input: StartMigration) => {
    if (input.mode === "apply") {
      setRefreshAsked(input.refresh ?? null)
      setApplying(input)
    } else {
      go(input)
    }
  }
  // The other sources' own fields; an incomplete parcel is sent as none
  const own = (mode: MigrationMode): StartMigration => {
    const read = WITH_PRODUCTS.has(kind) ? readParcel(parcel) : null
    return { kind, mode, parcel: read === "invalid" ? null : read, file, url: url.trim() }
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
          {kind === "wordpress" ? (
            <WordpressSource
              disabled={busy}
              pending={pending}
              onRun={(mode, chosen) => {
                request({ kind, mode, ...chosen })
              }}
            />
          ) : (
            <>
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
                <ParcelFields
                  inputProps={(field) => ({
                    value: parcel[field],
                    onChange: (event) => {
                      setParcel({ ...parcel, [field]: event.target.value })
                    },
                  })}
                />
              ) : null}
              <RunButtons
                disabled={!ready || busy}
                pending={pending}
                onCheck={() => {
                  request(own("check"))
                }}
                onApply={() => {
                  request(own("apply"))
                }}
              />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 rounded-md border bg-muted/30 p-4">
          {job.data ? <RunResult job={job.data} source={kind} /> : null}
          <RecentRuns
            busy={busy}
            onStarted={(started) => {
              setJobId(started.id)
            }}
          />
        </div>
      </div>
      <ConfirmDialog
        open={applying !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApplying(null)
          }
        }}
        title={t(
          refreshAsked === "post_images"
            ? `${R}.postImagesConfirmTitle`
            : refreshAsked
              ? `${R}.refreshConfirmTitle`
              : `${R}.confirmTitle`
        )}
        description={t(
          refreshAsked === "post_images"
            ? `${R}.postImagesConfirmText`
            : refreshAsked
              ? `${R}.refreshConfirmText`
              : `${R}.confirmText`
        )}
        confirmLabel={t(`${R}.apply`)}
        onConfirm={() => {
          setApplying(null)
          if (applying) {
            go(applying)
          }
        }}
      />
    </SectionCard>
  )
}
