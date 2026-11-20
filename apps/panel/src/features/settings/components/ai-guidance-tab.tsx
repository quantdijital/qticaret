import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { aiGuidanceQuery } from "@/features/ai/api/guidance"
import { useCan } from "@/features/auth/api/staff"
import { AiGuidanceCard } from "@/features/settings/components/ai-guidance-card"
import { AiGuidanceTasksCard } from "@/features/settings/components/ai-guidance-tasks-card"
import { errorText } from "@/lib/errors"

/**
 * Settings › Yapay zekâ › Yazım yönergesi (adr/0074 §2): the shop-wide
 * guidance on top, the tasks' own below in closed rows. Owner and admin
 * change it (`settings`); others read it.
 */
export function AiGuidanceTab() {
  const { t } = useTranslation()
  const mayChange = useCan("settings")
  const query = useQuery(aiGuidanceQuery())
  const saved = query.data?.values
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!saved) {
    return <LoadingRows />
  }
  return (
    <div className="flex flex-col gap-6">
      <AiGuidanceCard saved={saved} mayChange={mayChange} />
      <AiGuidanceTasksCard saved={saved} mayChange={mayChange} />
    </div>
  )
}
