import { Package } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * The package card's place on a shop the platform does not manage yet (no
 * signed plan document, adr/0061 §5.6): it says plainly that the package,
 * the payment day and the payments are not known here, instead of leaving
 * the page with tiles alone. No figure is shown that the platform did not
 * send.
 */
export function UnlinkedPlanCard() {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t("plan.package.label")}
      className="flex min-w-0 items-start gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-card sm:p-6"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Package className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[17px] leading-6 font-semibold">{t("plan.details.unlinked.title")}</h2>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {t("plan.details.unlinked.text")}
        </p>
      </div>
    </section>
  )
}
