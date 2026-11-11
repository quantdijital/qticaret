import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useRewrap } from "@/features/keys/api"
import type { KekRow, KekStatus } from "@/features/keys/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

const TONES: Record<KekRow["state"], StatusTone> = {
  current: "success",
  older: "warning",
  missing: "danger",
}

/**
 * The key-encryption keys (owner, adr/0061 §4.1): per fingerprint, how many
 * sealed secrets and TCKNs it wraps and whether it is still configured;
 * what waits for a rewrap, what cannot be opened (a key removed too soon,
 * said plainly) and which old key may now be removed. "Yeniden sar" asks
 * the step-up. Fingerprints and counts only.
 */
export function KeksCard({ status }: { status: KekStatus | undefined }) {
  const { t } = useTranslation()
  const rewrap = useRewrap()

  const columns: Column<KekRow>[] = [
    {
      key: "kek",
      header: t("keys.keks.columns.kek"),
      cell: (row) => <span className="font-mono text-[13px]">{row.kek_id}</span>,
    },
    {
      key: "state",
      header: t("keys.keks.columns.state"),
      cell: (row) => (
        <StatusBadge tone={TONES[row.state]}>{t(`keys.keks.state.${row.state}`)}</StatusBadge>
      ),
    },
    {
      key: "secrets",
      header: t("keys.keks.columns.secrets"),
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.records.secret_record}</span>,
    },
    {
      key: "tckn",
      header: t("keys.keks.columns.tckn"),
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.records.tenant_company}</span>,
    },
  ]

  return (
    <SectionCard
      title={t("keys.keks.title")}
      description={t("keys.keks.text")}
      flush
      action={
        <Button
          variant="outline"
          disabled={!status || rewrap.isPending}
          onClick={() => {
            rewrap.mutate(undefined, {
              onSuccess: (result) => {
                toast.success(t("keys.keks.rewrapped", { count: result.rewrapped }))
                if (result.failed > 0) {
                  toast.error(t("keys.keks.rewrapFailed", { count: result.failed }))
                }
              },
              onError: (error) => {
                if (!isStepUpCancelled(error)) {
                  toast.error(errorText(t, error))
                }
              },
            })
          }}
        >
          {t("keys.keks.rewrap")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={status?.keks}
        rowKey={(row) => row.kek_id}
        loading={!status}
        empty={t("keys.keks.empty")}
      />
      <div className="mt-auto flex flex-col gap-3 border-t px-5 py-4 text-[13px]">
        {status && status.stranded > 0 ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t("keys.keks.strandedTitle")}</AlertTitle>
            <AlertDescription>
              {t("keys.keks.strandedText", { count: status.stranded })}
            </AlertDescription>
          </Alert>
        ) : null}
        <p className="text-muted-foreground">
          {status && status.pending > 0
            ? t("keys.keks.pending", { count: status.pending })
            : t("keys.keks.allCurrent")}
        </p>
        {status?.removable.map((kek) => (
          <p key={kek} className="text-muted-foreground">
            {t("keys.keks.removable", { kek })}
          </p>
        ))}
      </div>
    </SectionCard>
  )
}
