import { CircleAlert, ShieldCheck } from "lucide-react"
import { useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import type { LayoutSettings } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { badgeProblems, settingsProblems } from "@/features/storefront/layout/settings-problems"
import { TrustBadgeList } from "./trust-badge-list"

const B = "storefront.editor.shared.badges"

/**
 * The product page draws the badges under its buy box without a section
 * (adr/0049 Ek 2026-11-06): a line under the product's own block says
 * where they are written and opens the one list in a dialog, its changes
 * going to the draft as a strip's form's do.
 */
export function BuyBoxBadges({
  settings,
  dispatch,
}: {
  settings: LayoutSettings
  dispatch: Dispatch<EditorAction>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const problems = badgeProblems(settingsProblems(settings))
  const wrong = Object.keys(problems).length > 0
  return (
    <div className="flex flex-col items-start gap-1 py-1 pr-2 pl-6">
      <p className="text-xs text-muted-foreground">{t(`${B}.buyBox`)}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 text-primary-text"
        onClick={() => {
          setOpen(true)
        }}
      >
        <ShieldCheck />
        {t(`${B}.edit`)}
        {wrong ? (
          <CircleAlert
            role="img"
            aria-label={t("storefront.editor.row.problem")}
            className="size-3.5 shrink-0 text-destructive-text"
          />
        ) : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(`${B}.title`)}</DialogTitle>
            <DialogDescription>{t(`${B}.description`)}</DialogDescription>
          </DialogHeader>
          <TrustBadgeList
            badges={settings.trust_badges}
            problems={problems}
            onChange={(trust_badges, field) => {
              dispatch({ type: "settings", settings: { ...settings, trust_badges }, merge: field })
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setOpen(false)
              }}
            >
              {t(`${B}.done`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
