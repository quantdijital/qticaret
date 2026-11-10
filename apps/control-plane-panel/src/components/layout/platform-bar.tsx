import { ShieldHalf } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * The permanent "Üst panel" bar (adr/0061 §1.4): above every page of this
 * panel, signed in or not, in the control plane's own colour, so platform
 * staff always know they are not in a shop's panel. It never scrolls away
 * and takes no focus; its height is a token (`--cp-bar-height`) the shell
 * and the menu are placed under.
 */
export function PlatformBar() {
  const { t } = useTranslation()
  return (
    <div
      role="note"
      aria-label={t("platformBar.label")}
      data-platform-bar=""
      className="sticky top-0 z-40 flex h-[var(--cp-bar-height)] shrink-0 items-center gap-3 bg-primary px-4 text-[13px] text-primary-foreground lg:px-[var(--page-padding-wide)]"
    >
      <ShieldHalf aria-hidden="true" className="size-4 shrink-0" />
      <span className="font-semibold tracking-tight">{t("platformBar.title")}</span>
      <span aria-hidden="true" className="hidden h-3.5 w-px bg-primary-foreground/40 sm:block" />
      <span className="hidden truncate sm:block">{t("platformBar.text")}</span>
    </div>
  )
}
