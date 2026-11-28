import { Link } from "@tanstack/react-router"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { useCan } from "@/features/auth/api/staff"

/** Where the "Örnek içerik" card lives in Settings: beside the catalog's own settings. */
export const SAMPLE_CARD_PATH = "/settings/attributes"
export const SAMPLE_CARD_ID = "sample-catalog"

/**
 * "Örnek": a product the sector pack's sample catalogue made, still its own
 * record (`isSampleProduct`), in the product list and on its page. Its
 * hover says what that means: shown in the store, never sold.
 */
export function SampleBadge() {
  const { t } = useTranslation()
  return (
    <span title={t("sampleCatalog.badgeHint")} className="inline-flex">
      <StatusBadge tone="info">{t("sampleCatalog.badge")}</StatusBadge>
    </span>
  )
}

/**
 * The line under a sample product's title: the cart refuses it
 * (`sample_catalog.not_for_sale`), so the owner is told before a customer
 * is; those who may remove samples get the way to the card.
 */
export function SampleProductNote() {
  const { t } = useTranslation()
  const canManage = useCan("samples")
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-info-soft px-3 py-2 text-sm text-info-text">
      <Info className="size-4 shrink-0" aria-hidden="true" />
      <span>{t("sampleCatalog.productNote")}</span>
      {canManage ? (
        <Link to={SAMPLE_CARD_PATH} hash={SAMPLE_CARD_ID} className="font-medium underline">
          {t("sampleCatalog.manage")}
        </Link>
      ) : null}
    </p>
  )
}
