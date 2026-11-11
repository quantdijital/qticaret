import { Link } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, LoaderCircle, RotateCcw, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"

/**
 * The wizard's actions, pinned to the bottom: cancel or back, then next,
 * or on the review "Kur". After a partial "Kur" (the record made, a save
 * failed): try the rest again, or go on from the shop's page.
 */
export function WizardFooter({
  first,
  last,
  made,
  partial,
  running,
  onBack,
  onInstall,
  onOpenShop,
}: {
  first: boolean
  last: boolean
  /** The record's id once made. */
  made: string | null
  partial: boolean
  running: boolean
  onBack: () => void
  onInstall: () => void
  onOpenShop: (id: string) => void
}) {
  const { t } = useTranslation()
  const leading = made ? (
    <span />
  ) : first ? (
    <Button variant="ghost" asChild>
      <Link to="/tenants">{t("common.cancel")}</Link>
    </Button>
  ) : (
    <Button type="button" variant="ghost" disabled={running} onClick={onBack}>
      <ArrowLeft />
      {t("wizard.back")}
    </Button>
  )
  if (!last) {
    return (
      <>
        {leading}
        <Button type="submit">
          {t("wizard.next")}
          <ArrowRight />
        </Button>
      </>
    )
  }
  return (
    <>
      {leading}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {made && partial ? (
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => {
              onOpenShop(made)
            }}
          >
            {t("wizard.partial.openShop")}
          </Button>
        ) : null}
        <Button type="button" disabled={running} onClick={onInstall}>
          {running ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" />
          ) : partial ? (
            <RotateCcw />
          ) : (
            <Wrench />
          )}
          {t(running ? "wizard.installing" : partial ? "wizard.partial.retry" : "wizard.install")}
        </Button>
      </div>
    </>
  )
}
