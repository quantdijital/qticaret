import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"

const C = "settings.shipping.ptt.checklist"
const ITEMS = ["contract", "privacy", "account", "range", "cod"] as const

/**
 * What the shop asks PTT for before connecting (docs/entegrasyonlar/ptt.md,
 * "Mağazadan istenecekler"): the contract with the Başmüdürlük, the third
 * party confidentiality undertaking, the customer number and password,
 * the barcode range, and the "ödeme şartlı" service for cash on delivery.
 */
export function PttChecklist() {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        {ITEMS.map((item) => (
          <li key={item}>{t(`${C}.${item}`)}</li>
        ))}
      </ol>
    </SectionCard>
  )
}
