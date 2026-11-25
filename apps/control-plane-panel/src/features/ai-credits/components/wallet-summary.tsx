import { useTranslation } from "react-i18next"
import { formatDate, formatCount } from "@qticaret/admin-ui/lib/format"
import { StatCard } from "@qticaret/admin-ui/patterns/stat-card"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { AiWallet } from "@/features/ai-credits/api/schemas"
import { grantLeftPercent } from "@/features/ai-credits/standing"
import { credits, monthText } from "@/features/ai-credits/words"

/**
 * The month's grant: what is left of the package's whole grant
 * (`monthly_grant`, P3d) with a plain bar of it. With no grant (0, or a
 * control plane before P3d) the remainder alone and no bar. StatCard's
 * markup, the bar under its hint.
 */
function PlanCard({ wallet }: { wallet: AiWallet }) {
  const { t } = useTranslation()
  const { plan } = wallet.balance
  const total = wallet.monthly_grant
  const percent = grantLeftPercent(wallet)
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <dt className="text-sm font-medium text-muted-foreground">{t("aiCredits.wallet.plan")}</dt>
      <dd className="flex flex-col gap-1">
        <span className="tabular text-2xl font-semibold leading-8 tracking-[-0.01em]">
          {total === undefined
            ? credits(t, plan.balance)
            : t("aiCredits.wallet.planValue", {
                left: formatCount(plan.balance),
                total: formatCount(total),
              })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("aiCredits.wallet.planHint", {
            month: monthText(plan.period),
            day: formatDate(plan.renewsOn),
          })}
        </span>
        {percent === null ? null : (
          <Progress
            value={percent}
            aria-label={t("aiCredits.wallet.planBar", { value: percent })}
            className="mt-1 h-1.5"
          />
        )}
      </dd>
    </div>
  )
}

/**
 * The wallet at a glance (adr/0085 K5–K7): this month's grant left of
 * the package's, bought credits and their last day, today's spend
 * against the day's cap (the shop's own, or the platform's).
 */
export function WalletSummary({ wallet }: { wallet: AiWallet }) {
  const { t } = useTranslation()
  const { purchased, daily } = wallet.balance
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <PlanCard wallet={wallet} />
      <StatCard
        label={t("aiCredits.wallet.purchased")}
        value={credits(t, purchased.balance)}
        hint={
          purchased.expiresAt
            ? t("aiCredits.wallet.expires", { day: formatDate(purchased.expiresAt) })
            : t("aiCredits.wallet.noneBought")
        }
      />
      <StatCard
        label={t("aiCredits.wallet.today")}
        value={t("aiCredits.wallet.todayValue", {
          spent: formatCount(daily.spent),
          cap: formatCount(daily.cap),
        })}
        hint={
          wallet.own_daily_cap === null
            ? t("aiCredits.wallet.capPlatform")
            : t("aiCredits.wallet.capOwn")
        }
      />
    </dl>
  )
}
