import { History, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Label } from "@qticaret/admin-ui/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@qticaret/admin-ui/ui/sheet"
import type { LayoutRevision } from "@/features/storefront/api/layout"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { BarButton } from "./bar-button"

const V = "storefront.editor.revisions"

interface RevisionsSheetProps {
  revisions: readonly LayoutRevision[]
  /** The revision on the storefront now (the last published). */
  live: number
  /** The draft holds changes (saved or not) a restore would replace: ask first. */
  ask: boolean
  busy: boolean
  /** `menus`: the menus the revision put live come with it (adr/0063 §3). */
  onRestore: (revision: number, menus: boolean) => void
}

/**
 * Each published design, newest first, any of them back into the draft. A
 * revision that put a menu set live says so before it is restored, and may
 * come without it (adr/0063 §3): published again, it would replace the
 * shop's menus with that day's.
 */
export function RevisionsSheet({ revisions, live, ask, busy, onRestore }: RevisionsSheetProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState<LayoutRevision | null>(null)
  const [skipMenus, setSkipMenus] = useState(false)
  const restore = (revision: LayoutRevision) => {
    if (ask || revision.has_menus) {
      setSkipMenus(false)
      setAsking(revision)
    } else {
      setOpen(false)
      onRestore(revision.revision, true)
    }
  }
  return (
    <>
      <BarButton
        variant="outline"
        icon={<History />}
        label={t(`${V}.open`)}
        onClick={() => {
          setOpen(true)
        }}
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t(`${V}.title`)}</SheetTitle>
            <SheetDescription>{t(`${V}.description`)}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {revisions.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
                {t(`${V}.empty`)}
              </p>
            ) : (
              <ol aria-label={t(`${V}.title`)} className="flex flex-col divide-y rounded-md border">
                {revisions.map((each) => (
                  <li key={each.revision} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {t(`${V}.item`, { revision: each.revision })}
                        {each.revision === live ? (
                          <StatusBadge tone="success">{t(`${V}.live`)}</StatusBadge>
                        ) : null}
                        {each.has_menus ? (
                          <StatusBadge tone="neutral">{t(`${V}.menusBadge`)}</StatusBadge>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(each.published_at)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      aria-label={t(`${V}.restoreOf`, { revision: each.revision })}
                      onClick={() => {
                        restore(each)
                      }}
                    >
                      <RotateCcw />
                      {t(`${V}.restore`)}
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAsking(null)
          }
        }}
        title={t(`${V}.confirmTitle`, { revision: asking?.revision ?? 0 })}
        description={t(ask ? `${V}.confirmText` : `${V}.confirmKeep`)}
        confirmLabel={t(`${V}.confirm`)}
        onConfirm={() => {
          if (asking !== null) {
            setOpen(false)
            onRestore(asking.revision, !skipMenus)
          }
          setAsking(null)
        }}
      >
        {asking?.has_menus ? (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/40 px-3 py-2.5 text-[13px] leading-5">
            <p>{t(`${V}.menusText`)}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="restore-skip-menus"
                checked={skipMenus}
                onCheckedChange={(checked) => {
                  setSkipMenus(checked === true)
                }}
              />
              <Label htmlFor="restore-skip-menus">{t(`${V}.skipMenus`)}</Label>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
