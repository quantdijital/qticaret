import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLinkOptions } from "@/features/storefront/api/link-options"
import type { LinkOption } from "@/features/storefront/api/link-options"
import type { RecordKind } from "@/features/storefront/api/menus"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"

const R = "storefront.editor.records"

interface RecordPickerDialogProps {
  kind: RecordKind
  /** The records chosen now: ticked. */
  chosen: readonly string[]
  /** Several may be chosen (the dialog stays open), or one (picking closes it). */
  multiple: boolean
  /** No more may be chosen: the unticked ones wait. */
  full?: boolean
  onToggle: (option: LinkOption) => void
  onClose: () => void
  /**
   * With `multiple`, the ticks are only kept by this button (a collection's
   * "Ekle"); closing otherwise drops them. Without it, "Tamam" closes.
   */
  done?: { label: string; busy?: boolean; onDone: () => void }
  /** The title in place of the kind's own. */
  title?: string
}

/**
 * Records of one kind searched by name, as the menus' link picker finds
 * them: a category with its place in the tree, a product not on sale yet
 * marked so. One click picks (or, with `multiple`, ticks and unticks).
 */
export function RecordPickerDialog({
  kind,
  chosen,
  multiple,
  full = false,
  onToggle,
  onClose,
  done,
  title,
}: RecordPickerDialogProps) {
  const { t } = useTranslation()
  const [q, setQ] = useState("")
  const options = useLinkOptions(kind, q)
  const rows = options.data ?? []
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent pane="fixed">
        <DialogHeader>
          <DialogTitle>{title ?? t(`${R}.pick.${kind}`)}</DialogTitle>
          <DialogDescription>{t(multiple ? `${R}.pickMany` : `${R}.pickOne`)}</DialogDescription>
        </DialogHeader>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={t("storefront.menus.picker.search")}
          className="shrink-0 sm:max-w-none"
        />
        <DialogBody list>
          {options.isError ? (
            <ErrorState text={errorText(t, options.error)} onRetry={() => void options.refetch()} />
          ) : options.isPending ? (
            <div aria-label={t("common.loading")} className="flex justify-center py-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {t(q ? "storefront.menus.picker.noMatch" : "storefront.menus.picker.none")}
            </p>
          ) : (
            <ul
              aria-label={t(`storefront.menus.kinds.${kind}`)}
              className="flex flex-col rounded-md border"
            >
              {rows.map((option) => {
                const ticked = chosen.includes(option.id)
                return (
                  <li key={option.id} className="border-t first:border-t-0">
                    <button
                      type="button"
                      aria-pressed={multiple ? ticked : undefined}
                      disabled={multiple && full && !ticked}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
                      onClick={() => {
                        onToggle(option)
                        if (!multiple) {
                          onClose()
                        }
                      }}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn("size-4 shrink-0", ticked ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{option.name}</span>
                        {option.detail ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {option.detail}
                          </span>
                        ) : null}
                      </span>
                      {option.live ? null : (
                        <StatusBadge tone="warning">
                          {t("storefront.menus.picker.notLive")}
                        </StatusBadge>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </DialogBody>
        {multiple && done ? (
          <DialogFooter>
            <Button type="button" variant="outline" disabled={done.busy} onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={(done.busy ?? false) || chosen.length === 0}
              onClick={done.onDone}
            >
              {done.busy ? <Loader2 className="animate-spin" /> : null}
              {done.label}
            </Button>
          </DialogFooter>
        ) : multiple ? (
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              {t(`${R}.done`)}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
