import { ExternalLink, LifeBuoy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  SUPPORT_REASON_MAX,
  SUPPORT_REASON_MIN,
  SUPPORT_SESSION_MINUTES,
} from "@qticaret/types/control-plane"
import type { SupportSessionMinutes, TenantStatus } from "@qticaret/types/control-plane"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useMe } from "@/features/auth/api"
import { useSupportGrant } from "@/features/tenants/mutations"
import type { SupportGrant } from "@/features/tenants/mutations"
import { canManageShops } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// As the control plane refuses: a shop being set up has no panel; a closing one takes no one in
const ENTERABLE: readonly TenantStatus[] = ["active", "restricted", "suspended"]

// One line: the reason reaches the shop's owner as written
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ")

function GrantDialog({
  tenantId,
  onClose,
  onIssued,
}: {
  tenantId: string
  onClose: () => void
  onIssued: (grant: SupportGrant) => void
}) {
  const { t } = useTranslation()
  const issue = useSupportGrant(tenantId)
  const [reason, setReason] = useState("")
  const [minutes, setMinutes] = useState<SupportSessionMinutes>(30)
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("supportAccess.title")}
      description={t("supportAccess.text")}
      dirty={reason !== ""}
      saving={issue.isPending}
      canSubmit={reason.trim().length >= SUPPORT_REASON_MIN}
      submitLabel={t("supportAccess.submit")}
      onSubmit={() => {
        setFailure(null)
        issue.mutate(
          { reason: reason.trim(), minutes },
          {
            onSuccess: onIssued,
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="support-reason">{t("supportAccess.reason")}</Label>
          <Textarea
            id="support-reason"
            rows={3}
            maxLength={SUPPORT_REASON_MAX}
            placeholder={t("supportAccess.reasonPlaceholder")}
            value={reason}
            onChange={(event) => {
              setReason(oneLine(event.target.value))
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("supportAccess.reasonHelp")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <p id="support-minutes-label" className="text-sm font-medium">
            {t("supportAccess.minutes")}
          </p>
          <RadioGroup
            aria-labelledby="support-minutes-label"
            value={String(minutes)}
            onValueChange={(next) => {
              setMinutes(Number(next) as SupportSessionMinutes)
            }}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            {SUPPORT_SESSION_MINUTES.map((each) => (
              <div key={each} className="flex items-center gap-2">
                <RadioGroupItem id={`support-minutes-${String(each)}`} value={String(each)} />
                <Label htmlFor={`support-minutes-${String(each)}`} className="font-normal">
                  {t("supportAccess.minutesOption", { count: each })}
                </Label>
              </div>
            ))}
          </RadioGroup>
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

function ReadyDialog({ grant, onClose }: { grant: SupportGrant; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("supportAccess.readyTitle")}</DialogTitle>
          <DialogDescription>
            {t("supportAccess.readyText", { time: formatDateTime(grant.expires_at) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {grant.owner_pending ? (
            <p role="alert" className="text-[13px] text-warning-text">
              {t("supportAccess.ownerPending")}
            </p>
          ) : null}
          <p className="text-[13px] text-muted-foreground">{t("supportAccess.bearerNote")}</p>
          <Button asChild className="self-start">
            <a href={grant.url} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <ExternalLink aria-hidden="true" />
              {t("supportAccess.openPanel")}
            </a>
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Mağaza paneline geç" on the shop's page (adr/0061 Ek "Destek erişimi"
 * 2026-11-28, Karar 7): for the owner and the operator, on a shop with a
 * panel to enter; a reason, a length and a step-up each time. The link is
 * shown once in this dialog and dropped when it closes.
 */
export function SupportAccess({ tenantId, status }: { tenantId: string; status: TenantStatus }) {
  const { t } = useTranslation()
  const me = useMe()
  const [open, setOpen] = useState(false)
  const [grant, setGrant] = useState<SupportGrant | null>(null)
  if (!ENTERABLE.includes(status) || !canManageShops(me?.role)) {
    return null
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true)
        }}
      >
        <LifeBuoy aria-hidden="true" />
        {t("supportAccess.open")}
      </Button>
      {open ? (
        <GrantDialog
          tenantId={tenantId}
          onClose={() => {
            setOpen(false)
          }}
          onIssued={(issued) => {
            setOpen(false)
            setGrant(issued)
          }}
        />
      ) : null}
      {grant ? (
        <ReadyDialog
          grant={grant}
          onClose={() => {
            setGrant(null)
          }}
        />
      ) : null}
    </>
  )
}
