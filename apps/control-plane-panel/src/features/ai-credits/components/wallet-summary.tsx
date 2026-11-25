import { useTranslation } from "react-i18next"
import { formatDate, formatCount } from "@qticaret/admin-ui/lib/format"
import { StatCard } from "@qticaret/admin-ui/patterns/stat-card"
import type { AiWallet } from "@/features/ai-credits/api/schemas"
import { credits, monthText } from "@/features/ai-credits/words"

/**
 * The wallet at a glance (adr/0085 K5–K7): this month's grant left of
 * the package's, bought credits and their last day, today's spend
 * against the day's cap (the shop's own, or the platform's).
 */
export function WalletSummary({
  wallet,
  monthlyGrant,
}: {
  wallet: AiWallet
  monthlyGrant: number
}) {
  const { t } = useTranslation()
  const { plan, purchased, daily } = wallet.balance
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label={t("aiCredits.wallet.plan")}
        value={t("aiCredits.wallet.planValue", {
          left: formatCount(plan.balance),
          total: formatCount(monthlyGrant),
        })}
        hint={t("aiCredits.wallet.planHint", {
          month: monthText(plan.period),
          day: formatDate(plan.renewsOn),
        })}
      />
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
