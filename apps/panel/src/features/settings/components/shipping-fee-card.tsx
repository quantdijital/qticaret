import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { FreeShippingCondition } from "@/features/settings/api/sections"
import { useSaveShippingFee } from "@/features/settings/api/shipping-fee"
import { FreeShippingConditionField } from "@/features/settings/components/free-shipping-condition-field"
import { CARRIER_PRICINGS, FEE_MODES, feeErrors, planFee } from "@/features/settings/shipping-fee"
import type { CarrierPricing, FeeChoice, FeeMode, FeeState } from "@/features/settings/shipping-fee"
import { errorText } from "@/lib/errors"

const S = "settings.shipping.fee"

const textOf = (amount: number | null) => (amount === null ? "" : formatMoneyInput(amount))

/** A money field of the answer, with its one error. */
function MoneyField({
  id,
  label,
  hint,
  value,
  invalid,
  error,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: string
  invalid: boolean
  error: string
  onChange: (text: string) => void
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={invalid ? error : undefined}>
      <NumberField
        decimals={2}
        min={0}
        suffix="₺"
        id={id}
        className="w-44"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </Field>
  )
}

/**
 * Settings > Shipping > "Kargo ücreti" (the owner, 2026-11-26): one
 * question with the answers shops know, its fields under the one chosen,
 * no dialog. It prices the main option and sets the free shipping total
 * (settings/shipping-fee.ts); the extra options are listed below it.
 */
export function ShippingFeeCard({
  state,
  tableEmpty,
  flatCarrier,
  connected,
}: {
  state: FeeState
  /** The shop's desi table has no rows: a table-priced answer warns (it does not stop). */
  tableEmpty: boolean
  /** Who carries a new flat-priced main option: the first contract carrier connected, else the shop. */
  flatCarrier: "manual" | "aras" | "yurtici" | "dhlecommerce"
  /** The carriers whose account is connected: a source of one that is not warns. */
  connected: readonly string[]
}) {
  const { t } = useTranslation()
  const save = useSaveShippingFee()
  const stored = state.choice
  const known = state.mode !== "custom" && state.mode !== "none"
  const [mode, setMode] = useState<FeeMode | null>(known ? stored.mode : null)
  const [fee, setFee] = useState(textOf(stored.fee))
  const [threshold, setThreshold] = useState(textOf(stored.threshold))
  const [carrier, setCarrier] = useState<CarrierPricing>(stored.carrier)
  const [condition, setCondition] = useState<FreeShippingCondition>(stored.condition)
  const [tried, setTried] = useState(false)
  const choice: FeeChoice | null = mode
    ? {
        mode,
        fee: parseMoneyInput(fee),
        threshold: threshold.trim() === "" ? null : parseMoneyInput(threshold),
        carrier,
        condition,
      }
    : null
  const errors = choice && tried ? feeErrors(choice) : []
  const dirty =
    mode !== (known ? stored.mode : null) ||
    fee !== textOf(stored.fee) ||
    threshold !== textOf(stored.threshold) ||
    carrier !== stored.carrier ||
    condition !== stored.condition
  const reset = () => {
    setMode(known ? stored.mode : null)
    setFee(textOf(stored.fee))
    setThreshold(textOf(stored.threshold))
    setCarrier(stored.carrier)
    setCondition(stored.condition)
    setTried(false)
  }
  const submit = () => {
    setTried(true)
    if (!choice || feeErrors(choice).length > 0) {
      return
    }
    const plan = planFee(state, choice, { name: t(`${S}.defaultName`), flatCarrier })
    save.mutate(plan, {
      onSuccess: ({ replacedKept }) => {
        toast.success(t("settings.saved"))
        if (replacedKept) {
          toast.warning(t(`${S}.replacedKept`))
        }
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const field = (name: "fee" | "threshold") => errors.includes(name)
  const tableChosen = mode === "carrier" && carrier.endsWith("-table")
  const sourceCarrier = carrier.split("-")[0] ?? ""
  const unconnected = mode === "carrier" && !connected.includes(sourceCarrier)
  return (
    <CardForm
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      dirty={dirty}
      saving={save.isPending}
      onReset={reset}
      onSubmit={submit}
    >
      {state.mode === "custom" ? (
        <p className="text-[13px] text-warning-text">{t(`${S}.customNote`)}</p>
      ) : state.mode === "none" ? (
        <p className="text-[13px] text-warning-text">{t(`${S}.noneNote`)}</p>
      ) : null}
      <RadioGroup
        aria-label={t(`${S}.title`)}
        value={mode ?? ""}
        onValueChange={(next) => {
          setMode(next as FeeMode)
        }}
        className="flex flex-col gap-2"
      >
        {FEE_MODES.map((each) => (
          <div
            key={each}
            className="flex flex-col gap-3 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary"
          >
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <RadioGroupItem value={each} />
              <span className="flex flex-col">
                <span className="font-medium">{t(`${S}.modes.${each}`)}</span>
                <span className="text-[13px] text-muted-foreground">
                  {t(`${S}.modeHints.${each}`)}
                </span>
              </span>
            </label>
            {mode === each && each === "threshold" ? (
              <div className="grid gap-4 pl-7 sm:grid-cols-2">
                <MoneyField
                  id="shipping-fee-threshold"
                  label={t(`${S}.threshold`)}
                  value={threshold}
                  invalid={field("threshold")}
                  error={t(`${S}.thresholdInvalid`)}
                  onChange={setThreshold}
                />
                <MoneyField
                  id="shipping-fee-below"
                  label={t(`${S}.feeBelow`)}
                  value={fee}
                  invalid={field("fee")}
                  error={t(`${S}.feeInvalid`)}
                  onChange={setFee}
                />
                <div className="sm:col-span-2">
                  <FreeShippingConditionField
                    id="shipping-fee-condition"
                    value={condition}
                    onChange={setCondition}
                  />
                </div>
              </div>
            ) : null}
            {mode === each && each === "flat" ? (
              <div className="pl-7">
                <MoneyField
                  id="shipping-fee-flat"
                  label={t(`${S}.feeFlat`)}
                  value={fee}
                  invalid={field("fee")}
                  error={t(`${S}.feeInvalid`)}
                  onChange={setFee}
                />
              </div>
            ) : null}
            {mode === each && each === "carrier" ? (
              <div className="flex flex-col gap-3 pl-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t(`${S}.source`)} htmlFor="shipping-fee-source">
                    <Select
                      value={carrier}
                      onValueChange={(next) => {
                        // Radix's hidden native select says "" as it mounts in a form
                        if (next !== "") {
                          setCarrier(next as CarrierPricing)
                        }
                      }}
                    >
                      <SelectTrigger id="shipping-fee-source" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARRIER_PRICINGS.map((source) => (
                          <SelectItem key={source} value={source}>
                            {t(`${S}.sources.${source}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <MoneyField
                    id="shipping-fee-carrier-threshold"
                    label={t(`${S}.thresholdOptional`)}
                    hint={t(`${S}.thresholdOptionalHint`)}
                    value={threshold}
                    invalid={field("threshold")}
                    error={t(`${S}.thresholdInvalid`)}
                    onChange={setThreshold}
                  />
                </div>
                {threshold.trim() !== "" ? (
                  <FreeShippingConditionField
                    id="shipping-fee-carrier-condition"
                    value={condition}
                    onChange={setCondition}
                  />
                ) : null}
                {unconnected ? (
                  <p className="text-[13px] text-warning-text">
                    {t(`${S}.notConnected`, {
                      carrier: t(`settings.shipping.options.carriers.${sourceCarrier}`),
                    })}
                  </p>
                ) : null}
                {tableChosen && tableEmpty ? (
                  <p className="text-[13px] text-warning-text">
                    {t(`${S}.tableEmpty`)}{" "}
                    <a href="#shipping-rates" className="font-medium underline">
                      {t(`${S}.tableLink`)}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </RadioGroup>
      {state.primary && state.mode !== "custom" ? (
        <p className="text-[13px] text-muted-foreground" data-testid="shipping-fee-primary">
          {t(`${S}.primary`, {
            name: state.primary.name,
            carrier: t(`settings.shipping.options.carriers.${state.primary.carrier ?? "manual"}`),
          })}
        </p>
      ) : null}
    </CardForm>
  )
}
