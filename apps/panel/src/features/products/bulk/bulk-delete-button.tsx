import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { deleteEach, groupReasons } from "@/features/products/bulk/bulk-delete"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

const B = "products.bulk.delete"

/**
 * "Sil" in the bulk bar: asks with the count, deletes the picked products
 * a few at a time and says how many went; the ones the server refused stay
 * picked, their reasons in the message, so they can be looked at.
 */
export function BulkDeleteButton({
  selected,
  onSelect,
  disabled,
}: {
  selected: ReadonlySet<string>
  onSelect: (ids: Set<string>) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const count = selected.size
  const run = async () => {
    const ids = [...selected]
    setDone(0)
    const outcome = await deleteEach(ids, (id) => sdk.admin.product.delete(id), setDone)
    setDone(null)
    onSelect(new Set(outcome.failed.map((item) => item.id)))
    await client.invalidateQueries({ queryKey: ["products"] })
    await client.invalidateQueries({ queryKey: ["dashboard"] })
    if (outcome.deleted.length > 0) {
      toast.success(
        t(`${B}.done`, {
          count: outcome.deleted.length,
          formatted: formatCount(outcome.deleted.length),
        })
      )
    }
    if (outcome.failed.length > 0) {
      const reasons = groupReasons(outcome.failed, (failure) => errorText(t, failure))
      toast.error(
        t(`${B}.skipped`, {
          count: outcome.failed.length,
          formatted: formatCount(outcome.failed.length),
        }),
        {
          description: reasons
            .slice(0, 3)
            .map(({ reason, count: times }) => `${reason} (${formatCount(times)})`)
            .join(" · "),
        }
      )
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        disabled={disabled || done !== null}
        onClick={() => {
          setAsking(true)
        }}
      >
        {done === null ? <Trash2 /> : <Loader2 className="animate-spin" />}
        {done === null
          ? t(`${B}.action`)
          : t(`${B}.working`, { done: formatCount(done), total: formatCount(count) })}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${B}.title`, { count, formatted: formatCount(count) })}
        description={t(`${B}.description`)}
        confirmLabel={t(`${B}.confirm`, { count, formatted: formatCount(count) })}
        destructive
        onConfirm={() => {
          setAsking(false)
          void run()
        }}
      />
    </>
  )
}
