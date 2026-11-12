import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { TARGET_REASON_MAX, releasesQuery, useSetTargetRelease } from "@/features/releases/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

const NONE = "none"

/**
 * "Hedef sürümü değiştir" (owner, operator; step-up, Ek C18): a known
 * release or none, and why. Intent only: the shop is not upgraded by it
 * (F16.6), as the dialog says.
 */
export function TargetDialog({
  tenantId,
  current,
  onClose,
}: {
  tenantId: string
  /** The target's release id; null: none. */
  current: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const releases = useQuery(releasesQuery())
  const change = useSetTargetRelease(tenantId)
  const [chosen, setChosen] = useState(current ?? NONE)
  const [reason, setReason] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const moved = chosen !== (current ?? NONE)
  const list = releases.data?.releases ?? []
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("version.change")}
      description={t("version.dialogText")}
      pane
      dirty={moved || reason !== ""}
      saving={change.isPending}
      canSubmit={moved && reason.trim().length >= 3}
      onSubmit={() => {
        setFailure(null)
        change.mutate(
          { release_id: chosen === NONE ? null : chosen, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success(t("version.saved"))
              onClose()
            },
            onError: (error) => {
              if (!isStepUpCancelled(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <p id="target-choice-label" className="text-sm font-medium">
          {t("version.pick")}
        </p>
        <RadioGroup
          aria-labelledby="target-choice-label"
          value={chosen}
          onValueChange={setChosen}
          className="flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem id="target-none" value={NONE} className="mt-0.5" />
            <Label htmlFor="target-none" className="flex flex-col items-start gap-0.5 font-normal">
              <span className="text-sm font-medium">{t("version.none")}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">
                {t("version.noneText")}
              </span>
            </Label>
          </div>
          {list.map((release) => (
            <div key={release.id} className="flex items-start gap-3">
              <RadioGroupItem id={`target-${release.id}`} value={release.id} className="mt-0.5" />
              <Label
                htmlFor={`target-${release.id}`}
                className="flex flex-col items-start gap-0.5 font-normal"
              >
                <span className="text-sm font-medium tabular-nums">{release.version}</span>
                <span className="text-[13px] leading-5 text-muted-foreground">
                  <span className="font-mono">{release.commit.slice(0, 12)}</span>
                  {` · ${formatDate(release.created_at)}`}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
        {releases.isSuccess && list.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("version.noReleases")}</p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="target-reason">{t("version.reasonLabel")}</Label>
          <Textarea
            id="target-reason"
            rows={3}
            maxLength={TARGET_REASON_MAX}
            value={reason}
            aria-describedby="target-reason-help"
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
          <p id="target-reason-help" className="text-[13px] text-muted-foreground">
            {t("version.reasonHelp")}
          </p>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
