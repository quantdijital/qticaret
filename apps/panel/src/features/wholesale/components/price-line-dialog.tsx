import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { searchVariants } from "@/features/orders/api/edit"
import { useSetPrices } from "@/features/wholesale/api/tiers"
import type { ListOwner, WholesaleLine } from "@/features/wholesale/api/types"
import { lineName } from "@/features/wholesale/format"
import { errorText } from "@/lib/errors"
import { WarningNote } from "./warning-note"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

const P = "wholesale.prices"
const NET_ID = "wholesale-net"
/** The most a price may be, as the server takes it (20 million lira). */
const MAX_NET = 20_000_000

/** Lira as the server takes it: "1250.50". */
const wire = (amount: number) => amount.toFixed(2)

/** KDV included as the server works it out: the net with the rate, to the kuruş. */
const grossOf = (net: number, vatPercent: number) => Math.round(net * (100 + vatPercent)) / 100

interface PriceLineDialogProps {
  owner: ListOwner
  /** A line to change; null to price a variant not on the list yet. */
  line: WholesaleLine | null
  /** A variant to price, chosen before opening (one the rate gives 0,00). */
  variant?: PickerOption | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** What the line says around the field: retail now, the KDV, and a warning when retail is cheaper. */
function LineFacts({ line, net }: { line: WholesaleLine; net: number | null }) {
  const { t } = useTranslation()
  const retail = line.retail_now === null ? null : Number(line.retail_now)
  const gross = net === null ? null : grossOf(net, line.vat_percent)
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/40 px-4 py-3 text-[13px]">
        <dt className="text-muted-foreground">{t(`${P}.retailNow`)}</dt>
        <dd className="text-right tabular-nums">
          {retail === null ? "—" : formatMoney(retail, "try")}
        </dd>
        <dt className="text-muted-foreground">{t(`${P}.vatRate`)}</dt>
        <dd className="text-right tabular-nums">%{line.vat_percent}</dd>
        <dt className="text-muted-foreground">{t(`${P}.gross`)}</dt>
        <dd className="text-right tabular-nums">
          {gross === null ? "—" : formatMoney(gross, "try")}
        </dd>
      </dl>
      {retail !== null && gross !== null && retail < gross ? (
        <WarningNote>{t(`${P}.undercutHint`)}</WarningNote>
      ) : null}
    </>
  )
}

/**
 * One wholesale price typed by hand, KDV excluded (ADR-0068 §4): the
 * server adds the variant's KDV, to the kuruş. A hand-entered price can
 * be taken away: the rate prices the variant again, or retail does. A
 * price above retail is warned about, never refused (Ek 2026-11-15).
 */
export function PriceLineDialog({
  owner,
  line,
  variant,
  open,
  onOpenChange,
}: PriceLineDialogProps) {
  const { t } = useTranslation()
  const save = useSetPrices(owner)
  const initial = line ? formatMoneyInput(Number(line.net)) : ""
  const [text, setText] = useState(initial)
  const [picked, setPicked] = useState<PickerOption | null>(variant ?? null)
  const [error, setError] = useState<string | undefined>()
  const [failure, setFailure] = useState<string | null>(null)
  const net = parseMoneyInput(text)
  const variantId = line?.variant_id ?? picked?.id ?? null
  const close = () => {
    setError(undefined)
    setFailure(null)
    onOpenChange(false)
  }
  const send = (body: Parameters<typeof save.mutate>[0], done: string) => {
    setFailure(null)
    save.mutate(body, {
      onSuccess: () => {
        toast.success(done)
        close()
      },
      onError: (refused) => {
        setFailure(errorText(t, refused))
      },
    })
  }
  const submit = () => {
    if (net === null || !(net > 0) || net > MAX_NET) {
      setError(t(`${P}.errors.net`))
      return
    }
    if (!variantId) {
      setError(t(`${P}.errors.variant`))
      return
    }
    send({ set: [{ variant_id: variantId, net: wire(net) }] }, t(`${P}.saved`))
  }
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        } else {
          onOpenChange(true)
        }
      }}
      title={t(line ? `${P}.editTitle` : `${P}.addTitle`)}
      description={line ? lineName(line) : t(`${P}.addText`)}
      dirty={text !== initial || (!line && picked !== null)}
      canSubmit={variantId !== null && text.trim() !== ""}
      saving={save.isPending}
      initialFocus={line || picked ? NET_ID : null}
      onSubmit={submit}
      footerStart={
        line?.source === "manual" ? (
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              send({ remove: [line.variant_id] }, t(`${P}.removed`))
            }}
          >
            {t(`${P}.remove`)}
          </Button>
        ) : undefined
      }
    >
      <DialogBody>
        {line ? null : (
          <Field label={t(`${P}.variant`)} htmlFor="wholesale-variant" required>
            <SearchPicker
              id="wholesale-variant"
              value={picked}
              onChange={(next) => {
                setPicked(next)
                setError(undefined)
              }}
              search={searchVariants}
              queryKey={["wholesale", "variant-search"]}
              placeholder={t(`${P}.variantPlaceholder`)}
              empty={t(`${P}.noVariants`)}
              className="w-full max-w-none"
            />
          </Field>
        )}
        <Field
          label={t(`${P}.net`)}
          htmlFor={NET_ID}
          hint={line?.source === "rate" ? t(`${P}.fromRate`) : t(`${P}.netHint`)}
          error={error}
          required
        >
          <NumberField
            id={NET_ID}
            decimals={2}
            min={0}
            suffix="₺"
            className="w-48"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setError(undefined)
            }}
          />
        </Field>
        {line ? <LineFacts line={line} net={net} /> : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
