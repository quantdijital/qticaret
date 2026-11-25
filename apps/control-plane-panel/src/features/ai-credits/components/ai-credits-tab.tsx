import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { settingsQuery, walletQuery } from "@/features/ai-credits/api/queries"
import { creditsOff } from "@/features/ai-credits/standing"
import type { TenantDetail } from "@/features/tenants/api"
import { errorText } from "@/lib/errors"
import { AdjustDialog } from "./adjust-dialog"
import { DailyCapDialog } from "./daily-cap-dialog"
import { LedgerTable } from "./ledger-table"
import { WalletSummary } from "./wallet-summary"

/**
 * A shop's "Yapay zekâ kredisi" tab (adr/0085 §5; the owner's alone): its
 * wallet, its ledger, "Kredi ekle / düş" and its own day's cap. With the
 * credits off for the shop (flag or status, as the wallet's answer says
 * them, P3d) the tab says so, and the wallet is still shown: a correction
 * may be due before it opens again.
 */
export function AiCreditsTab({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const id = shop.tenant.id
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<"adjust" | "cap" | null>(null)
  const wallet = useQuery(walletQuery(id, page))
  const settings = useQuery(settingsQuery())
  const data = wallet.data
  const actions = data ? (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen("cap")
        }}
      >
        {t("aiCredits.dailyCap.open")}
      </Button>
      <Button
        onClick={() => {
          setOpen("adjust")
        }}
      >
        {t("aiCredits.adjust.open")}
      </Button>
    </>
  ) : undefined
  return (
    <div className="flex flex-col gap-4">
      {data && creditsOff(data) ? (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>{t("aiCredits.tab.off")}</AlertDescription>
        </Alert>
      ) : null}
      <SectionCard
        title={t("aiCredits.tab.title")}
        description={t("aiCredits.tab.text")}
        action={actions}
      >
        {wallet.isError ? (
          <ErrorState text={errorText(t, wallet.error)} onRetry={() => void wallet.refetch()} />
        ) : data ? (
          <WalletSummary wallet={data} />
        ) : (
          <Skeleton className="h-24 rounded-lg" />
        )}
      </SectionCard>
      {wallet.isError ? null : (
        <SectionCard title={t("aiCredits.ledger.title")} flush>
          <LedgerTable
            wallet={data}
            loading={wallet.isPending}
            stale={wallet.isPlaceholderData}
            page={page}
            onPage={setPage}
          />
        </SectionCard>
      )}
      {open === "adjust" ? (
        <AdjustDialog
          tenantId={id}
          shopName={shop.tenant.name}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
      {open === "cap" && data ? (
        <DailyCapDialog
          tenantId={id}
          ownCap={data.own_daily_cap}
          platformCap={settings.data?.settings.daily_cap ?? null}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </div>
  )
}
