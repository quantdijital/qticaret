import { useQuery } from "@tanstack/react-query"
import { PackagePlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useRunAction } from "@/features/provisioning/api"
import type { ProvisioningState } from "@/features/provisioning/api"
import { actionRules } from "@/features/provisioning/rules"
import { DEFAULT_SECTOR_PACK, packName, sectorPacksQuery } from "@/features/sector-packs/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

export interface ShopPack {
  /** The record's pack; none: the general one. */
  sector_pack: string | null
  sector_pack_version: number | null
  sector_pack_applied_at: string | null
}

/**
 * The shop's sector pack (adr/0061 C12): which, the version it last
 * applied and when, and "Paketi yeniden uygula" ("Paketi uygula" before
 * it ever has): an `apply_pack` run behind a step-up, offered by the same
 * rules as the setup's other actions (a shop set up once, being set up or
 * active, no run under way); why it cannot start is said once, on the
 * actions card beside it (the same rules, the same reasons). It only adds
 * what the shop never had, so a newer version of the pack is said here.
 */
export function PackCard({
  tenantId,
  status,
  state,
  shop,
}: {
  tenantId: string
  status: TenantStatus
  state: ProvisioningState | undefined
  shop: ShopPack
}) {
  const { t } = useTranslation()
  const packs = useQuery(sectorPacksQuery())
  const run = useRunAction(tenantId)
  const [failure, setFailure] = useState<string | null>(null)
  const rule = actionRules(state, status).apply_pack
  const code = shop.sector_pack ?? DEFAULT_SECTOR_PACK
  const current = packs.data?.sector_packs.find((pack) => pack.code === code)
  const applied = shop.sector_pack_version
  const newer = current && applied !== null && current.version > applied ? current.version : null
  const apply = () => {
    setFailure(null)
    run.mutate("apply_pack", {
      onSuccess: () => {
        toast.success(t("setup.started.apply_pack"))
      },
      onError: (error) => {
        if (!isStepUpCancelled(error)) {
          setFailure(errorText(t, error))
        }
      },
    })
  }
  const facts: [string, string][] = [
    [t("setup.pack.name"), packName(packs.data?.sector_packs, code)],
    [
      t("setup.pack.applied"),
      applied === null
        ? t("setup.pack.notApplied")
        : t("sectorPacks.version", { version: applied }),
    ],
    [
      t("setup.pack.appliedAt"),
      shop.sector_pack_applied_at ? formatDateTime(shop.sector_pack_applied_at) : "—",
    ],
  ]
  return (
    <SectionCard title={t("setup.pack.title")} description={t("setup.pack.text")}>
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      {newer !== null ? (
        <p className="mt-3 text-[13px] leading-5">{t("setup.pack.newer", { version: newer })}</p>
      ) : null}
      <Button
        variant="outline"
        className="mt-3 w-full justify-start"
        disabled={!rule.enabled || run.isPending}
        onClick={apply}
      >
        <PackagePlus aria-hidden="true" />
        {t(applied === null ? "setup.actions.applyPack" : "setup.actions.reapplyPack")}
      </Button>
      {failure ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {failure}
        </p>
      ) : null}
    </SectionCard>
  )
}
