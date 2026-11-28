import { ArrowUpCircle } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDateTime, formatRelative } from "@qticaret/admin-ui/lib/format"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Facts } from "@/features/billing/components/facts"
import { useRunAction, useShopRuns } from "@/features/provisioning/api"
import { upgradeRule } from "@/features/provisioning/rules"
import { codeText } from "@/features/provisioning/words"
import type { TenantDetail } from "@/features/tenants/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { RunStatusBadge } from "./run-card"

/**
 * The shop's "Sürüm yükseltme" card (audit 3.1), for who runs shops: its
 * last upgrade (how it went, why it stopped) and "Sürümü yükselt", asked
 * first (the shop goes down for a few minutes) and behind a step-up. The
 * run's steps are on the "Kurulum" tab.
 */
export function UpgradeCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const id = shop.tenant.id
  const runs = useShopRuns(id, true)
  const run = useRunAction(id)
  const [asking, setAsking] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const rule = upgradeRule(runs.data, shop)
  const last = runs.data?.runs.find((each) => each.kind === "upgrade") ?? null
  const rows: [string, ReactNode][] = last
    ? [
        [
          t("upgrade.last"),
          <span key="last" className="flex flex-wrap items-center gap-2">
            <RunStatusBadge status={last.status} />
            {`${formatRelative(last.started_at)} · ${formatDateTime(last.started_at)}`}
          </span>,
        ],
        ...(last.status === "failed"
          ? ([[t("backup.failedReason"), codeText(t, last.error_code)]] as [string, ReactNode][])
          : []),
      ]
    : [[t("upgrade.last"), t("upgrade.never")]]
  return (
    <SectionCard title={t("upgrade.title")} description={t("upgrade.text")}>
      <div className="flex flex-col gap-4">
        <Facts rows={rows} />
        <div className="flex flex-col gap-2">
          <Button
            className="w-full justify-start sm:w-auto sm:self-start"
            disabled={!rule.enabled || run.isPending}
            onClick={() => {
              setAsking(true)
            }}
          >
            <ArrowUpCircle aria-hidden="true" />
            {t("upgrade.action")}
          </Button>
          <p className="text-[13px] text-muted-foreground">
            {rule.reason ? t(rule.reason) : t("upgrade.steps")}
          </p>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("upgrade.confirmTitle")}
        description={t("upgrade.confirmText", { to: shop.version.target?.version ?? "" })}
        confirmLabel={t("upgrade.action")}
        onConfirm={() => {
          setAsking(false)
          setFailure(null)
          run.mutate("upgrade", {
            onSuccess: () => {
              toast.success(t("setup.started.upgrade"))
            },
            onError: (error) => {
              if (!isStepUpCancelled(error)) {
                setFailure(errorText(t, error))
              }
            },
          })
        }}
      />
    </SectionCard>
  )
}
