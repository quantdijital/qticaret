import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { aiGuidanceQuery } from "@/features/ai/api/guidance"
import type { AiGuidanceSettings } from "@/features/ai/api/guidance"
import { useCan } from "@/features/auth/api/staff"
import { AiGuidanceCard } from "@/features/settings/components/ai-guidance-card"
import { AiGuidanceTasksCard } from "@/features/settings/components/ai-guidance-tasks-card"
import { AiGuidanceTry } from "@/features/settings/components/ai-guidance-try"
import { errorText } from "@/lib/errors"

type ShopPart = Omit<AiGuidanceSettings, "tasks">

/**
 * Settings › Yapay zekâ › Yazım yönergesi (adr/0074 §2): the shop-wide
 * guidance on top, the tasks' own below in closed rows, and "Dene" last,
 * which tries the guidance as both cards hold it, saved or not. Owner and
 * admin change it (`settings`) and try it; others read it.
 */
export function AiGuidanceTab() {
  const { t } = useTranslation()
  const mayChange = useCan("settings")
  const query = useQuery(aiGuidanceQuery())
  const saved = query.data?.values
  // What the cards hold now; until they report, the saved values
  const [shop, setShop] = useState<ShopPart | null>(null)
  const [tasks, setTasks] = useState<AiGuidanceSettings["tasks"] | null>(null)
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!saved) {
    return <LoadingRows />
  }
  const current: AiGuidanceSettings = { ...saved, ...shop, tasks: tasks ?? saved.tasks }
  return (
    <div className="flex flex-col gap-6">
      <AiGuidanceCard saved={saved} mayChange={mayChange} onDraft={setShop} />
      <AiGuidanceTasksCard saved={saved} mayChange={mayChange} onDraft={setTasks} />
      {mayChange ? <AiGuidanceTry guidance={current} mayChange={mayChange} /> : null}
    </div>
  )
}
