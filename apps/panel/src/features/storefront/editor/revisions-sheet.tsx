import { History, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { LayoutRevision } from "@/features/storefront/api/layout"
import { formatDateTime } from "@/lib/format"
import { BarButton } from "./bar-button"

const V = "storefront.editor.revisions"

interface RevisionsSheetProps {
  revisions: readonly LayoutRevision[]
  /** The revision on the storefront now (the last published). */
  live: number
  /** The draft holds changes (saved or not) a restore would replace: ask first. */
  ask: boolean
  busy: boolean
  onRestore: (revision: number) => void
}

/** Each published design, newest first, any of them back into the draft. */
export function RevisionsSheet({ revisions, live, ask, busy, onRestore }: RevisionsSheetProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState<number | null>(null)
  const restore = (revision: number) => {
    if (ask) {
      setAsking(revision)
    } else {
      setOpen(false)
      onRestore(revision)
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
                        restore(each.revision)
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
        title={t(`${V}.confirmTitle`, { revision: asking ?? 0 })}
        description={t(`${V}.confirmText`)}
        confirmLabel={t(`${V}.confirm`)}
        onConfirm={() => {
          if (asking !== null) {
            setOpen(false)
            onRestore(asking)
          }
          setAsking(null)
        }}
      />
    </>
  )
}
