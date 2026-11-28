import { ExternalLink, HardDriveDownload, Info } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDateTime, formatRelative } from "@qticaret/admin-ui/lib/format"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useMe } from "@/features/auth/api"
import { Facts } from "@/features/billing/components/facts"
import { useRunAction, useShopRuns } from "@/features/provisioning/api"
import { actionRules } from "@/features/provisioning/rules"
import { codeText, sizeText } from "@/features/provisioning/words"
import type { TenantDetail } from "@/features/tenants/api"
import { canManageShops } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

/** Restore is the runbook's, from the command line only (audit 3.2). */
export const RESTORE_RUNBOOK =
  "https://github.com/quantdijital/qticaret/blob/dev/docs/runbooks/yedek-ve-geri-yukleme.md"

/**
 * The shop's "Yedek" card (audit 3.2), every role's: its latest backup
 * (when, how big, whether its files went with it, why it failed). "Şimdi
 * yedekle" for who runs shops, behind a step-up, offered by the setup's
 * rules; the run's steps are on the "Kurulum" tab. Restore is not a
 * button: the runbook's link says how.
 */
export function BackupCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const manager = canManageShops(me?.role)
  const id = shop.tenant.id
  const runs = useShopRuns(id, manager)
  const run = useRunAction(id)
  const [failure, setFailure] = useState<string | null>(null)
  const rule = actionRules(runs.data, shop.tenant.status).backup
  const busy = runs.data?.latest?.status === "running" && runs.data.latest.kind === "backup"
  const last = shop.backup
  const state = last?.status ?? "none"
  const rows: [string, ReactNode][] = last
    ? [
        [t("backup.last"), `${formatRelative(last.at)} · ${formatDateTime(last.at)}`],
        ...(last.status === "succeeded" && last.bytes !== null
          ? ([
              [
                t("backup.size"),
                last.files
                  ? `${sizeText(last.bytes)} · ${t("backup.files")}`
                  : sizeText(last.bytes),
              ],
            ] as [string, ReactNode][])
          : []),
        ...(last.status === "failed"
          ? ([[t("backup.failedReason"), codeText(t, last.error_code)]] as [string, ReactNode][])
          : []),
      ]
    : [[t("backup.last"), t("backup.none")]]
  return (
    <SectionCard
      title={t("backup.title")}
      description={t("backup.text")}
      action={
        <StatusBadge
          tone={state === "succeeded" ? "success" : state === "failed" ? "danger" : "neutral"}
        >
          {t(`backup.state.${state}`)}
        </StatusBadge>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts rows={rows} />
        {manager ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full justify-start sm:w-auto sm:self-start"
              disabled={!rule.enabled || run.isPending}
              onClick={() => {
                setFailure(null)
                run.mutate("backup", {
                  onSuccess: () => {
                    toast.success(t("setup.started.backup"))
                  },
                  onError: (error) => {
                    if (!isStepUpCancelled(error)) {
                      setFailure(errorText(t, error))
                    }
                  },
                })
              }}
            >
              <HardDriveDownload aria-hidden="true" />
              {busy ? t("backup.running") : t("backup.action")}
            </Button>
            {!rule.enabled && rule.reason && !busy ? (
              <p className="text-[13px] text-muted-foreground">{t(rule.reason)}</p>
            ) : null}
            {failure ? (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="flex items-start gap-2 border-t pt-4 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("backup.restore")}{" "}
            <a
              href={RESTORE_RUNBOOK}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("backup.runbook")}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </span>
        </p>
      </div>
    </SectionCard>
  )
}
