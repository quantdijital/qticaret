import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2, TriangleAlert } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DialogHeading } from "@qticaret/admin-ui/patterns/dialog-heading"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { errorText } from "@/lib/errors"
import { sayDroppedPages } from "@/features/storefront/editor/dropped-pages"
import { REPORT_KEY, useApplyLook } from "./api"
import type { ApplyReport, ApplyTarget } from "./api"
import { applyLines } from "./apply-lines"
import { NAME_MAX, suggestedName } from "./design-name"

const A = "storefront.gallery.apply"

interface ApplyDialogProps {
  /** The look asked about; null: closed. */
  target: ApplyTarget | null
  onClose: () => void
  /** The draft holds changes not yet published. */
  draftChanged: boolean
  /** The draft carries a menu set waiting to be published (a ready-made look's, a restore's). */
  pendingMenus: boolean
  /** No room for another named look. */
  savedFull: boolean
  savedLimit: number
  /** What the draft is now, for the name offered when it is kept by name. */
  currentName: string
}

const targetName = (target: ApplyTarget) =>
  target.kind === "preset" ? target.preset.name : target.name

/**
 * "‘Tezgâh’ taslağa uygulansın mı?": what applying the look changes and
 * what it keeps, the draft kept first (automatically, or by a name typed
 * here); then the editor opens on the new draft with a note of it.
 */
export function ApplyDialog(props: ApplyDialogProps) {
  const { target, onClose } = props
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      {target ? <ApplyContent {...props} target={target} /> : null}
    </Dialog>
  )
}

function ApplyContent({
  target,
  onClose,
  draftChanged,
  pendingMenus,
  savedFull,
  savedLimit,
  currentName,
}: ApplyDialogProps & { target: ApplyTarget }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const apply = useApplyLook()
  const ids = useId()
  const [keep, setKeep] = useState(false)
  const [name, setName] = useState(() => suggestedName(t, currentName))
  const trimmed = name.trim()
  const saveAs = keep && !savedFull ? trimmed : null
  const lookName = targetName(target)
  const menusReplaced = target.kind === "preset" && target.preset.has_menus
  const submit = () => {
    apply.mutate(
      { target, saveAs },
      {
        onSuccess: ({ result }) => {
          const report: ApplyReport = {
            name: lookName,
            auto_saved: result.auto_saved,
            saved_name: result.auto_saved?.name ?? null,
            skipped: result.skipped,
            kept: result.kept ?? [],
          }
          client.setQueryData(REPORT_KEY, report)
          sayDroppedPages(t, result.dropped_pages ?? 0)
          onClose()
          void navigate({ to: "/storefront/editor" })
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <DialogContent size="md">
      <DialogHeading title={t(`${A}.title`, { name: lookName })} />
      <DialogBody>
        {menusReplaced ? (
          <Alert>
            <TriangleAlert className="text-warning" />
            <AlertDescription>{t(`${A}.menusReplaced`)}</AlertDescription>
          </Alert>
        ) : null}
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-5 text-muted-foreground marker:text-border">
          {applyLines(target, draftChanged, pendingMenus).map((line) => (
            <li key={line}>{t(`${A}.${line}`)}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 rounded-md border bg-muted/40 px-3 py-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id={`${ids}-keep`}
              checked={keep && !savedFull}
              disabled={savedFull}
              aria-describedby={savedFull ? `${ids}-full` : undefined}
              onCheckedChange={(checked) => {
                setKeep(checked === true)
              }}
            />
            <Label htmlFor={`${ids}-keep`} className="leading-5">
              {t(`${A}.saveAs.label`)}
            </Label>
          </div>
          {savedFull ? (
            <p id={`${ids}-full`} className="text-xs text-muted-foreground">
              {t(`${A}.saveAs.full`, { max: savedLimit })}
            </p>
          ) : null}
          {keep && !savedFull ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-name`} className="text-xs">
                {t("storefront.gallery.save.name")}
              </Label>
              <Input
                id={`${ids}-name`}
                value={name}
                maxLength={NAME_MAX}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value)
                }}
              />
            </div>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="cancel" disabled={apply.isPending} onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          disabled={apply.isPending || (saveAs !== null && saveAs.length === 0)}
          onClick={submit}
        >
          {apply.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${A}.confirm`)}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
