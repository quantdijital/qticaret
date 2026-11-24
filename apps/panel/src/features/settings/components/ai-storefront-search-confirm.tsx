import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"

/** The shop's own flag for search in the shopper's words (adr/0077 §7; backend `AI_STOREFRONT_SEARCH`). */
export const AI_STOREFRONT_SEARCH_FLAG = "ai.storefront_search"

const S = "ai.storefrontSearch.confirm"

/**
 * Asks before search in the shopper's own words goes on (adr/0077 §7,
 * KVKK; security review O-1): what shoppers type goes to the connected AI
 * service, which may be abroad, under the shop's own key; contact details
 * are taken out but a name or an address in the sentence may not be; the
 * shop's privacy notice should say so. The storefront tells shoppers not
 * to type personal details. Every way the panel turns the flag on asks
 * this first (Settings › Yapay zekâ and Settings › Özellikler).
 */
export function AiStorefrontSearchConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      confirmLabel={t(`${S}.confirm`)}
      onConfirm={onConfirm}
    >
      <div className="flex flex-col gap-2 text-sm">
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-warning-text"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`${S}.personal`)}
        </p>
        <p className="text-muted-foreground">{t(`${S}.notice`)}</p>
      </div>
    </ConfirmDialog>
  )
}
