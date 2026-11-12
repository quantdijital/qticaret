import { Info } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { formatDateTime, formatRelative } from "@qticaret/admin-ui/lib/format"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useMe } from "@/features/auth/api"
import { Facts } from "@/features/billing/components/facts"
import { canManageReleases } from "@/features/releases/api"
import { matchWord } from "@/features/releases/words"
import type { TenantDetail } from "@/features/tenants/api"
import { TargetDialog } from "./target-dialog"

const CLOSED = new Set(["closing", "closed"])

/**
 * A shop's "Sürüm" tab (adr/0061 F17.5, Ek C18): the release its latest
 * usage report names (version · commit, when), its target (who set it,
 * when; why to who sets targets) and whether the two agree. "Hedef
 * sürümü değiştir" for who runs shops, not on a shop being closed; one
 * sentence says a target is intent only.
 */
export function VersionCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const [changing, setChanging] = useState(false)
  const { reported, target, matches } = shop.version
  const word = matchWord(matches)
  const editable = canManageReleases(me?.role) && !CLOSED.has(shop.tenant.status)
  const line = (version: string, commit: string) =>
    t("version.line", { version, commit: commit.slice(0, 12) })
  const rows: [string, ReactNode][] = [
    [
      t("version.running"),
      reported ? line(reported.version, reported.commit) : t("version.noReport"),
    ],
    ...(reported
      ? ([
          [
            t("version.lastReport"),
            `${formatRelative(reported.reported_at)} · ${formatDateTime(reported.reported_at)}`,
          ],
        ] as [string, ReactNode][])
      : []),
    [t("version.target"), target ? line(target.version, target.commit) : t("version.noTarget")],
    ...(target
      ? ([
          [
            t("version.setBy"),
            target.set_by
              ? `${target.set_by} · ${formatDateTime(target.set_at)}`
              : formatDateTime(target.set_at),
          ],
          ...(target.reason ? [[t("version.reason"), target.reason]] : []),
        ] as [string, ReactNode][])
      : []),
  ]
  return (
    <SectionCard
      title={t("version.title")}
      description={t("version.text")}
      action={
        <>
          <StatusBadge tone={word.tone}>{t(`version.state.${word.key}`)}</StatusBadge>
          {editable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setChanging(true)
              }}
            >
              {t("version.change")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts rows={rows} />
        <p className="flex items-start gap-2 border-t pt-4 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("releases.intent")}
        </p>
      </div>
      {changing ? (
        <TargetDialog
          tenantId={shop.tenant.id}
          current={target?.id ?? null}
          onClose={() => {
            setChanging(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
