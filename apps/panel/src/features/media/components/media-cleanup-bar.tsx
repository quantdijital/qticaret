import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { useDeleteUnusedMedia } from "@/features/media/api/media"
import type { MediaAsset, MediaBatchDeleted } from "@/features/media/api/media"
import { errorText } from "@/lib/errors"

const count = (value: number) => ({ count: value, formatted: formatCount(value) })

interface MediaCleanupBarProps {
  /** The page's pictures nothing shows. */
  items: MediaAsset[]
  selected: ReadonlySet<string>
  onSelect: (ids: Set<string>) => void
  /** Whether this person may delete (the catalog roles). */
  canDelete: boolean
}

/**
 * Above the "Kullanılmayan" view (M1): what the view holds, picking the
 * page's pictures, and deleting the picked ones for good (asked first).
 * The server checks each again and keeps any something shows.
 */
export function MediaCleanupBar({ items, selected, onSelect, canDelete }: MediaCleanupBarProps) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const remove = useDeleteUnusedMedia()
  const allPicked = items.length > 0 && items.every((asset) => selected.has(asset.id))
  const report = (answer: MediaBatchDeleted) => {
    if (answer.deleted.length > 0) {
      toast.success(t("media.cleanup.deleted", count(answer.deleted.length)))
    }
    const kept = answer.in_use.length + answer.failed.length
    if (kept > 0) {
      toast.warning(t("media.cleanup.kept", count(kept)))
    }
  }
  const confirm = () => {
    remove.mutate([...selected], {
      onSuccess: (answer) => {
        report(answer)
        onSelect(new Set())
      },
      onError: (failure) => {
        toast.error(errorText(t, failure))
      },
      onSettled: () => {
        setAsking(false)
      },
    })
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/60 px-5 py-2.5 text-sm">
      <span className="text-muted-foreground">
        {canDelete ? t("media.cleanup.hint") : t("media.cleanup.hintReadOnly")}
      </span>
      {canDelete && items.length > 0 ? (
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          {selected.size > 0 ? (
            <span className="font-medium" aria-live="polite">
              {t("media.cleanup.selected", count(selected.size))}
            </span>
          ) : null}
          <Button
            variant="link"
            className="h-auto p-0 text-foreground underline"
            onClick={() => {
              onSelect(allPicked ? new Set() : new Set(items.map((asset) => asset.id)))
            }}
          >
            {allPicked ? t("media.cleanup.clear") : t("media.cleanup.selectPage")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.size === 0 || remove.isPending}
            onClick={() => {
              setAsking(true)
            }}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {t("media.cleanup.delete")}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("media.cleanup.confirmTitle", count(selected.size))}
        description={t("media.cleanup.confirmText")}
        confirmLabel={t("media.cleanup.confirm")}
        destructive
        onConfirm={confirm}
      />
    </div>
  )
}
