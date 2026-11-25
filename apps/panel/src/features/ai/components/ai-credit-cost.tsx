import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { PLATFORM_SERVICE, aiCreditsQuery, mayReadCredits } from "@/features/ai/api/credits"
import { useStaff } from "@/features/auth/api/staff"

export interface AiCreditCostProps {
  /** What one operation (or one item of a bulk job) runs: its price is the sum of theirs. */
  tasks: readonly string[]
  /** The service chosen: only the platform's credits have a price to say. */
  service: string
  /** A bulk job's items at most; left out: one operation. */
  items?: number
}

/**
 * "Bu iş kaç kredi" beside an AI action (adr/0085 §4): on the platform's
 * credits only, read from the wallet's `tasks` (the server's table, never
 * one kept here) and only by a role that may read the wallet. One
 * operation says its price when dearer than one credit; a bulk job says
 * its price per item and the most it may take (per item × items). Words
 * only: the server charges, this never decides what may run.
 */
export function AiCreditCost({ tasks, service, items }: AiCreditCostProps) {
  // Off the platform nothing is read, not even who is signed in
  return service === PLATFORM_SERVICE && tasks.length > 0 ? (
    <PlatformCreditCost tasks={tasks} items={items} />
  ) : null
}

function PlatformCreditCost({
  tasks,
  items,
}: {
  tasks: readonly string[]
  items: number | undefined
}) {
  const { t } = useTranslation()
  const reads = mayReadCredits(useStaff()?.role)
  const wallet = useQuery({ ...aiCreditsQuery(), enabled: reads, retry: false })
  const table = reads && wallet.data?.available ? wallet.data.tasks : null
  const prices = table === null ? [] : tasks.map((task) => table[task])
  // A task the table does not price (or no wallet) says nothing rather than a wrong sum
  if (prices.length === 0 || prices.some((each) => each === undefined)) {
    return null
  }
  const each = prices.reduce<number>((sum, price) => sum + (price ?? 0), 0)
  if (items === undefined) {
    return each > 1 ? (
      <p className="text-xs text-muted-foreground" data-slot="ai-credit-cost">
        {t("ai.credits.cost", { credits: formatCount(each) })}
      </p>
    ) : null
  }
  return items > 0 ? (
    <p className="text-xs text-muted-foreground" data-slot="ai-credit-cost">
      {t("ai.credits.costEach", {
        credits: formatCount(each),
        total: formatCount(each * items),
      })}
    </p>
  ) : null
}
