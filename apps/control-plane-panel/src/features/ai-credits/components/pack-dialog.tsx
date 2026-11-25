import { Info } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  formatMoneyInput,
  parseCountInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { packsBody, useSaveSettings } from "@/features/ai-credits/api/mutations"
import type { PackInput } from "@/features/ai-credits/api/mutations"
import type { AiPackSetting } from "@/features/ai-credits/api/schemas"
import { ApiError } from "@/lib/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// The control plane's bounds (AI_CREDIT_MOVE_MAX; a pack's amount in kuruş)
const CREDITS_MAX = 1_000_000
const AMOUNT_MAX = 100_000_000
const NAME_MAX = 100

/**
 * A pack added or edited (adr/0085 K11, K12): name, credits, price in
 * lira (sent in kuruş) and whether it is on sale. Saved on the packs as
 * they are now (read again first). Editing says what the server does: a
 * pack whose credits or price change gets a new id, so a pending request
 * keeps the price it was opened at (PR #374 D3).
 */
export function PackDialog({ pack, onClose }: { pack: AiPackSetting | null; onClose: () => void }) {
  const { t } = useTranslation()
  const save = useSaveSettings()
  const [name, setName] = useState(pack?.name ?? "")
  const [credits, setCredits] = useState(pack ? String(pack.credits) : "")
  const [amount, setAmount] = useState(pack ? formatMoneyInput(pack.amount / 100) : "")
  const [active, setActive] = useState(pack?.active ?? true)
  const [failure, setFailure] = useState<string | null>(null)
  const creditsValue = parseCountInput(credits)
  const lira = parseMoneyInput(amount)
  const kurus = lira === null ? null : Math.round(lira * 100)
  const ready =
    name.trim() !== "" &&
    creditsValue !== null &&
    creditsValue >= 1 &&
    creditsValue <= CREDITS_MAX &&
    kurus !== null &&
    kurus >= 1 &&
    kurus <= AMOUNT_MAX
  const submit = () => {
    if (!ready) {
      return
    }
    const next: PackInput = { name: name.trim(), credits: creditsValue, amount: kurus, active }
    setFailure(null)
    save.mutate(
      (current) => {
        const packs = packsBody(current.packs)
        if (!pack) {
          return { packs: [...packs, next] }
        }
        if (!packs.some((each) => each.id === pack.id)) {
          // Changed or deleted by someone else since the page was read
          throw new ApiError(409, "cp.ai_pack_unknown", "conflict")
        }
        return {
          packs: packs.map((each) => (each.id === pack.id ? { ...next, id: pack.id } : each)),
        }
      },
      {
        onSuccess: () => {
          toast.success(t("aiCredits.packs.dialog.done"))
          onClose()
        },
        onError: (error) => {
          if (!isStepUpCancelled(error)) {
            setFailure(errorText(t, error))
          }
        },
      }
    )
  }
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={pack ? t("aiCredits.packs.dialog.edit") : t("aiCredits.packs.dialog.new")}
      dirty
      saving={save.isPending}
      canSubmit={ready}
      onSubmit={submit}
    >
      <DialogBody>
        {pack ? (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>{t("aiCredits.packs.dialog.idNote")}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="pack-name">{t("aiCredits.packs.dialog.name")}</Label>
          <Input
            id="pack-name"
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
            }}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pack-credits">{t("aiCredits.packs.dialog.credits")}</Label>
            <NumberField
              id="pack-credits"
              min={1}
              max={CREDITS_MAX}
              suffix={t("aiCredits.unit")}
              value={credits}
              onChange={(event) => {
                setCredits(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pack-amount">{t("aiCredits.packs.dialog.amount")}</Label>
            <NumberField
              id="pack-amount"
              min={0.01}
              decimals={2}
              suffix="₺"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
              }}
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch
            id="pack-active"
            checked={active}
            onCheckedChange={setActive}
            aria-describedby="pack-active-help"
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="pack-active">{t("aiCredits.packs.dialog.active")}</Label>
            <span id="pack-active-help" className="text-[13px] text-muted-foreground">
              {t("aiCredits.packs.dialog.activeHelp")}
            </span>
          </div>
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
