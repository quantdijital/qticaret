import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import type { Domain } from "@/features/tenants/api"
import { isVerified } from "@/features/tenants/api"
import {
  useAddDomain,
  useCheckDomain,
  usePrimaryDomain,
  useRemoveDomain,
} from "@/features/tenants/mutations"
import { errorText } from "@/lib/errors"
import { DomainDnsPanel } from "./domain-dns"
import { VerificationBadge } from "./verification-badge"

// Two labels at least, letters, digits and hyphens; the control plane checks again
const HOSTNAME = /^(?=.{4,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z][a-z0-9-]*$/

/** The shop's own domain recorded (owner, operator); its DNS records then show on its row. */
export function AddDomainDialog({
  tenantId,
  open,
  onOpenChange,
  onAdded,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The recorded domain: its window opens with the records to publish. */
  onAdded?: (domain: { id: string; hostname: string }) => void
}) {
  const { t } = useTranslation()
  const add = useAddDomain(tenantId)
  const [hostname, setHostname] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const typed = hostname.trim().toLowerCase().replace(/\.$/, "")
  const close = (next: boolean) => {
    if (!next) {
      setHostname("")
      setFailure(null)
    }
    onOpenChange(next)
  }
  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      size="sm"
      title={t("domains.add")}
      description={t("domains.addText")}
      dirty={hostname !== ""}
      saving={add.isPending}
      canSubmit={HOSTNAME.test(typed)}
      submitLabel={t("domains.addSubmit")}
      onSubmit={() => {
        setFailure(null)
        add.mutate(typed, {
          onSuccess: (answer) => {
            toast.success(t("domains.added"))
            close(false)
            onAdded?.(answer.domain)
          },
          onError: (error) => {
            setFailure(errorText(t, error))
          },
        })
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="domain-hostname">{t("domains.hostname")}</Label>
          <Input
            id="domain-hostname"
            autoComplete="off"
            spellCheck={false}
            placeholder="www.magazaniz.com"
            value={hostname}
            onChange={(event) => {
              setHostname(event.target.value)
            }}
          />
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

/**
 * One domain, opened from the list: its kind, state and date; for the
 * shop's own, the DNS records to publish and "Doğrula" (DNS asked now);
 * "Birincil yap" for a verified one (an unverified address as the
 * canonical one would break the storefront's links: said, not offered),
 * "Kaldır" for the shop's own (the platform's subdomain stays). Both are
 * proved again (step-up).
 */
export function DomainDialog({
  tenantId,
  domain,
  steps,
  writable,
  onClose,
}: {
  tenantId: string
  domain: Domain | null
  steps: RecordSteps
  writable: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const primary = usePrimaryDomain(tenantId)
  const remove = useRemoveDomain(tenantId)
  const check = useCheckDomain(tenantId)
  const [asking, setAsking] = useState(false)
  const fail = (error: unknown) => toast.error(errorText(t, error))
  const facts: [string, React.ReactNode][] = domain
    ? [
        [t("domains.columns.kind"), t(`domains.kinds.${domain.kind}`)],
        [t("domains.columns.state"), <VerificationBadge key="state" domain={domain} />],
        [t("domains.added_on"), formatDate(domain.created_at)],
      ]
    : []
  const footer =
    domain && writable ? (
      <>
        {domain.kind === "custom" ? (
          <Button
            variant="outline"
            disabled={remove.isPending}
            onClick={() => {
              setAsking(true)
            }}
          >
            {t("domains.remove")}
          </Button>
        ) : null}
        {domain.kind === "custom" ? (
          <Button
            variant={isVerified(domain) ? "outline" : "default"}
            disabled={check.isPending}
            onClick={() => {
              check.mutate(domain.id, {
                onSuccess: (answer) => {
                  const state = answer.domain.verification
                  if (state === "verified" || state === "active") {
                    toast.success(t("domains.checkProved"))
                  } else {
                    toast.info(t("domains.checkNotYet"))
                  }
                },
                onError: fail,
              })
            }}
          >
            {check.isPending ? t("domains.checking") : t("domains.check")}
          </Button>
        ) : null}
        {domain.is_primary ? null : (
          <Button
            disabled={!isVerified(domain) || primary.isPending}
            onClick={() => {
              primary.mutate(domain.id, {
                onSuccess: () => toast.success(t("domains.primarySaved")),
                onError: fail,
              })
            }}
          >
            {t("domains.makePrimary")}
          </Button>
        )}
      </>
    ) : undefined
  return (
    <>
      <DetailDialog
        open={domain !== null}
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        title={domain?.hostname ?? ""}
        description={domain?.is_primary ? t("domains.isPrimary") : undefined}
        headerAction={
          <RecordStepper
            {...steps}
            previousLabel={t("domains.previous")}
            nextLabel={t("domains.next")}
          />
        }
        footer={footer}
      >
        <DialogBody>
          <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[13px] text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {domain?.kind === "custom" && !isVerified(domain) ? (
            <p className="text-[13px] text-muted-foreground">
              {t(domain.verification === "failed" ? "domains.failedText" : "domains.pendingText")}
            </p>
          ) : null}
          {domain?.kind === "custom" && domain.dns ? (
            <DomainDnsPanel domain={domain} dns={domain.dns} />
          ) : null}
          {domain?.kind === "platform_subdomain" ? (
            <p className="text-[13px] text-muted-foreground">{t("domains.platformText")}</p>
          ) : null}
        </DialogBody>
      </DetailDialog>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("domains.confirm.title")}
        description={t("domains.confirm.text", { host: domain?.hostname ?? "" })}
        confirmLabel={t("domains.confirm.action")}
        destructive
        onConfirm={() => {
          if (domain) {
            remove.mutate(domain.id, {
              onSuccess: () => {
                toast.success(t("domains.removed"))
                onClose()
              },
              onError: fail,
            })
          }
        }}
      />
    </>
  )
}
