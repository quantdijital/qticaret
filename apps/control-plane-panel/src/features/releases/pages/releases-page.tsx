import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useMe } from "@/features/auth/api"
import { canManageReleases, releasesQuery } from "@/features/releases/api"
import type { Release } from "@/features/releases/api"
import { AddReleaseDialog, ReleaseDialog } from "@/features/releases/components/release-dialogs"
import { errorText } from "@/lib/errors"

/**
 * Sürümler (adr/0061 F17.5, Ek C18): the releases the platform knows,
 * newest first, with how many shops run and target each. "Sürüm ekle"
 * for who runs shops (step-up); a row opens the release, its note
 * editable by them. One sentence says a target is intent only (F16.6
 * upgrades).
 */
export function ReleasesPage() {
  const { t } = useTranslation()
  const me = useMe()
  const list = useQuery(releasesQuery())
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Release | null>(null)
  const editor = canManageReleases(me?.role)
  const columns: Column<Release>[] = [
    {
      key: "version",
      header: t("releases.columns.version"),
      cell: (row) => (
        <button
          type="button"
          className="font-medium tabular-nums hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            setOpen(row)
          }}
        >
          {row.version}
        </button>
      ),
    },
    {
      key: "commit",
      header: t("releases.columns.commit"),
      cell: (row) => <span className="font-mono text-[13px]">{row.commit.slice(0, 12)}</span>,
    },
    {
      key: "notes",
      header: t("releases.columns.notes"),
      className: "hidden md:table-cell",
      cell: (row) =>
        row.notes ? (
          <span className="line-clamp-1 max-w-[28rem]">{row.notes}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "reported",
      header: t("releases.columns.reported"),
      align: "right",
      cell: (row) => formatCount(row.reported_count),
    },
    {
      key: "target",
      header: t("releases.columns.target"),
      align: "right",
      cell: (row) => formatCount(row.target_count),
    },
    {
      key: "created",
      header: t("releases.columns.created"),
      className: "hidden sm:table-cell",
      cell: (row) => formatDate(row.created_at),
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("releases.title")}
        description={t("releases.text")}
        action={
          editor ? (
            <Button
              onClick={() => {
                setAdding(true)
              }}
            >
              {t("releases.add")}
            </Button>
          ) : undefined
        }
      />
      <Alert>
        <Info aria-hidden="true" />
        <AlertDescription>{t("releases.intent")}</AlertDescription>
      </Alert>
      {list.isError ? (
        <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
      ) : (
        <SectionCard title={t("releases.list")} flush>
          <DataTable
            columns={columns}
            rows={list.data?.releases}
            rowKey={(row) => row.id}
            onRowClick={setOpen}
            loading={list.isPending}
            empty={t("releases.empty")}
          />
        </SectionCard>
      )}
      {adding ? (
        <AddReleaseDialog
          onClose={() => {
            setAdding(false)
          }}
        />
      ) : null}
      {open ? (
        <ReleaseDialog
          key={open.id}
          release={open}
          editable={editor}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </div>
  )
}
