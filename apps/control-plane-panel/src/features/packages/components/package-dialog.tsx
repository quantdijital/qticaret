import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import {
  formatMoneyInput,
  parseCountInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"
import { useArchivePlan, useCreatePlan, useUpdatePlan } from "@/features/packages/api"
import type { Plan } from "@/features/packages/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { draftsOf, limitsOf } from "./limit-drafts"
import type { LimitDrafts } from "./limit-drafts"
import { LimitFields } from "./limit-fields"
import { PriceFields } from "./price-fields"
import type { PriceDraft } from "./price-fields"

const CODE = /^[a-z][a-z0-9-]{1,39}$/

interface Draft extends PriceDraft {
  code: string
  name: string
  limits: LimitDrafts
}

const draftOf = (plan: Plan | null): Draft => ({
  code: plan?.code ?? "",
  name: plan?.name ?? "",
  price: plan ? formatMoneyInput(plan.price / 100) : "",
  period: plan?.period ?? "monthly",
  trial: String(plan?.trial_days ?? 14),
  grace: String(plan?.grace_days ?? 7),
  limits: draftsOf(plan?.limits ?? null),
})

/**
 * A package in one dialog (docs/18 §7), new or opened from the list: its
 * code (fixed once made: the plan document names it), name, price per
 * period, trial and grace days and every limit. A changed price or period
 * asks the step-up and applies from each shop's next period (adr/0061 §7).
 * "Arşivle" says first how many shops are on it: they keep it.
 */
export function PackageDialog({
  plan,
  steps,
  writable,
  onClose,
}: {
  plan: Plan | null
  steps: RecordSteps | null
  writable: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const archive = useArchivePlan()
  const [shown, setShown] = useState(plan?.id ?? null)
  const [draft, setDraft] = useState(() => draftOf(plan))
  const [asking, setAsking] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  if ((plan?.id ?? null) !== shown) {
    setShown(plan?.id ?? null)
    setDraft(draftOf(plan))
    setFailure(null)
  }
  const price = parseMoneyInput(draft.price)
  const trial = parseCountInput(draft.trial)
  const grace = parseCountInput(draft.grace)
  const limits = limitsOf(draft.limits)
  const valid =
    draft.name.trim() !== "" &&
    (plan !== null || CODE.test(draft.code)) &&
    price !== null &&
    trial !== null &&
    trial <= 365 &&
    grace !== null &&
    grace <= 90 &&
    limits !== null
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(plan))
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const saving = create.isPending || update.isPending
  const fail = (error: unknown) => {
    if (!isStepUpCancelled(error)) {
      setFailure(errorText(t, error))
    }
  }
  const submit = () => {
    if (!valid) {
      return
    }
    setFailure(null)
    const input = {
      name: draft.name.trim(),
      price: Math.round(price * 100),
      period: draft.period,
      trial_days: trial,
      grace_days: grace,
      limits,
    }
    const done = {
      onSuccess: () => {
        toast.success(t(plan ? "packages.saved" : "packages.created"))
        onClose()
      },
      onError: fail,
    }
    if (plan) {
      update.mutate({ id: plan.id, before: plan, input }, done)
    } else {
      create.mutate({ ...input, code: draft.code }, done)
    }
  }
  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        size="lg"
        pane
        title={plan ? plan.name : t("packages.create")}
        description={plan ? t("packages.codeLine", { code: plan.code }) : t("packages.newText")}
        headerAction={
          steps ? (
            <RecordStepper
              {...steps}
              previousLabel={t("packages.previous")}
              nextLabel={t("packages.next")}
            />
          ) : undefined
        }
        dirty={writable && dirty}
        saving={saving}
        canSubmit={writable && valid}
        footerStart={
          plan && writable ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAsking(true)
              }}
            >
              {t(plan.archived_at ? "packages.restore" : "packages.archive")}
            </Button>
          ) : undefined
        }
        onSubmit={submit}
      >
        <DialogBody>
          <fieldset disabled={!writable} className="contents">
            <div className="grid gap-4 sm:grid-cols-2">
              {plan ? null : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="package-code">{t("packages.code")}</Label>
                  <Input
                    id="package-code"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.code}
                    onChange={(event) => {
                      set("code", event.target.value.toLowerCase())
                    }}
                  />
                  <p className="text-[13px] text-muted-foreground">{t("packages.codeHelp")}</p>
                </div>
              )}
              <div className={plan ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"}>
                <Label htmlFor="package-name">{t("packages.name")}</Label>
                <Input
                  id="package-name"
                  autoComplete="off"
                  value={draft.name}
                  onChange={(event) => {
                    set("name", event.target.value)
                  }}
                />
              </div>
            </div>
          </fieldset>
          <DialogSection
            title={t("packages.priceTitle")}
            description={plan ? t("packages.priceNote") : undefined}
          >
            <PriceFields
              draft={draft}
              disabled={!writable}
              onChange={(key, value) => {
                setDraft((current) => ({ ...current, [key]: value }))
              }}
            />
          </DialogSection>
          <DialogSection title={t("packages.limitsTitle")}>
            <LimitFields
              drafts={draft.limits}
              disabled={!writable}
              onChange={(key, next) => {
                set("limits", { ...draft.limits, [key]: next })
              }}
            />
          </DialogSection>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </DialogBody>
      </FormDialog>
      {plan ? (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={t(
            plan.archived_at ? "packages.confirmRestore.title" : "packages.confirmArchive.title"
          )}
          description={
            plan.archived_at
              ? t("packages.confirmRestore.text", { name: plan.name })
              : t("packages.confirmArchive.text", {
                  name: plan.name,
                  count: plan.tenant_count ?? 0,
                })
          }
          confirmLabel={t(plan.archived_at ? "packages.restore" : "packages.archive")}
          destructive={plan.archived_at === null}
          onConfirm={() => {
            archive.mutate(
              { id: plan.id, archive: plan.archived_at === null },
              {
                onSuccess: () => {
                  toast.success(t(plan.archived_at ? "packages.restored" : "packages.archivedDone"))
                  onClose()
                },
                onError: (error) => toast.error(errorText(t, error)),
              }
            )
          }}
        />
      ) : null}
    </>
  )
}
