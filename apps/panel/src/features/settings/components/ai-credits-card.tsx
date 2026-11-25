import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Hourglass } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"
import { aiCreditsQuery, formatMinorMoney, mayReadCredits } from "@/features/ai/api/credits"
import type { AiCreditsWallet } from "@/features/ai/api/credits"
import { useStaff } from "@/features/auth/api/staff"
import { AiCreditTopupDialog } from "@/features/settings/components/ai-credit-topup-dialog"

const C = "ai.credits"

/**
 * Settings > Yapay zekâ: the platform's credits (adr/0085 §5). This
 * month's grant and when it renews, the topped-up credits and their last
 * day, the day's limit once it is reached, an open request and "Kredi
 * yükle" (the owner's alone). Every number is the server's. Drawn only
 * while the credits are available: the flag off (or the wallet unread,
 * loading) the card is not there at all, no skeleton, so a shop without
 * the credits sees no trace of them.
 */
export function AiCreditsCard() {
  const { t } = useTranslation()
  const role = useStaff()?.role
  const credits = useQuery({ ...aiCreditsQuery(), enabled: mayReadCredits(role) })
  const [topUp, setTopUp] = useState(false)
  const wallet = credits.data
  if (!mayReadCredits(role) || !wallet?.available) {
    return null
  }
  const owner = role === "owner"
  const exhausted = wallet.plan.remaining === 0 && wallet.purchased.remaining === 0
  const pending = wallet.pending_order
  const canTopUp = owner && pending === null && wallet.packs.length > 0

  return (
    <SectionCard
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      action={
        canTopUp ? (
          <Button
            type="button"
            size="sm"
            variant={exhausted ? "default" : "outline"}
            onClick={() => {
              setTopUp(true)
            }}
          >
            {t(`${C}.topUp`)}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          {exhausted ? (
            <p className="text-sm font-medium text-destructive-text">{t(`${C}.exhausted`)}</p>
          ) : null}
          <Balance wallet={wallet} />
          {!exhausted && wallet.daily.remaining === 0 ? (
            <p className="text-warning-text">{t(`${C}.dailyReached`)}</p>
          ) : null}
        </div>
        {pending ? (
          <Alert role="status">
            <Hourglass aria-hidden="true" />
            <AlertDescription className="text-foreground">
              <span>{t(`${C}.pending`)}</span>
              <span className="text-muted-foreground">
                {t(`${C}.pendingPack`, {
                  credits: formatCount(pending.credits),
                  amount: formatMinorMoney(pending.amount, pending.currency),
                })}
              </span>
            </AlertDescription>
          </Alert>
        ) : null}
        {owner && pending === null && wallet.packs.length === 0 ? (
          <p className="text-muted-foreground">{t(`${C}.noPacks`)}</p>
        ) : null}
        <TaskCosts tasks={wallet.tasks} />
      </div>
      {topUp ? (
        <AiCreditTopupDialog
          onClose={() => {
            setTopUp(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}

/** This month's grant, then the topped-up credits while there are any. */
function Balance({ wallet }: { wallet: AiCreditsWallet }) {
  const { t } = useTranslation()
  const { plan, purchased } = wallet
  return (
    <>
      <p className="flex flex-wrap gap-x-2">
        {plan.remaining > 0 ? (
          <>
            <span className="font-medium tabular-nums">
              {t(`${C}.plan`, { remaining: formatCount(plan.remaining) })}
            </span>
            <span className="text-muted-foreground">
              {t(`${C}.planRenews`, { date: formatDate(plan.renews_on) })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {t(`${C}.planUsedUp`, { date: formatDate(plan.renews_on) })}
          </span>
        )}
      </p>
      {purchased.remaining > 0 ? (
        <p className="flex flex-wrap gap-x-2">
          <span className="font-medium tabular-nums">
            {t(`${C}.purchased`, { remaining: formatCount(purchased.remaining) })}
          </span>
          {purchased.expires_on ? (
            <span className="text-muted-foreground">
              {t(`${C}.purchasedExpires`, { date: formatDate(purchased.expires_on) })}
            </span>
          ) : null}
        </p>
      ) : null}
    </>
  )
}

/** "Bir işlem kaç kredi?": the gateway's table, folded; task names in the panel's words. */
function TaskCosts({ tasks }: { tasks: Record<string, number> }) {
  const { t } = useTranslation()
  const rows = Object.entries(tasks)
  if (rows.length === 0) {
    return null
  }
  return (
    <details className="group text-muted-foreground">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs hover:text-foreground">
        <ChevronRight
          className="size-3.5 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        {t(`${C}.costs`)}
      </summary>
      <table className="mt-2 w-full max-w-sm text-xs">
        <thead className="sr-only">
          <tr>
            <th scope="col">{t(`${C}.costsTask`)}</th>
            <th scope="col">{t(`${C}.costsCredits`)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([task, cost]) => (
            <tr key={task} className="border-b last:border-b-0">
              <th scope="row" className="py-1 pr-3 text-left font-normal break-words">
                {t(`ai.tasks.${task}`, { defaultValue: task })}
              </th>
              <td className="py-1 text-right text-foreground tabular-nums">
                {t(`${C}.cost`, { credits: formatCount(cost) })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
