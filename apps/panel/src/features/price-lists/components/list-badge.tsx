import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { PriceList } from "@/features/price-lists/api/price-lists"
import { listSchedule } from "@/features/price-lists/form"
import { SCHEDULE_TONE } from "@/features/promotions/offer"

/** Where a list stands today: on, waiting for its first day, over, or a draft. */
export function ListBadge({ list }: { list: Pick<PriceList, "status" | "starts_at" | "ends_at"> }) {
  const { t } = useTranslation()
  const schedule = listSchedule(list)
  return (
    <StatusBadge tone={SCHEDULE_TONE[schedule]}>{t(`priceLists.schedule.${schedule}`)}</StatusBadge>
  )
}
