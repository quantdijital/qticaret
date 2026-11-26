import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { PromotionSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const S = "settings.shipping.freeShipping"
/** The card's anchor: "Kargo ayarlarında değiştir" on the promotions page opens here. */
export const FREE_SHIPPING_ANCHOR = "free-shipping"
// 10.000.000 TL, as the server takes it
const MAX_THRESHOLD = 10_000_000

function ThresholdForm({ stored }: { stored: number | null }) {
  const { t } = useTranslation()
  const save = useSaveSection<PromotionSettings>("promotions")
  const [on, setOn] = useState(stored !== null)
  const [text, setText] = useState(stored === null ? "" : formatMoneyInput(stored))
  const [tried, setTried] = useState(false)
  const amount = parseMoneyInput(text)
  const valid = !on || (amount !== null && amount > 0 && amount <= MAX_THRESHOLD)
  const wanted = on ? amount : null
  const dirty = on !== (stored !== null) || (on && wanted !== stored)
  // An empty field just switched on is not yet a mistake
  const shown = valid || (!tried && text.trim() === "")
  const reset = () => {
    setTried(false)
    setOn(stored !== null)
    setText(stored === null ? "" : formatMoneyInput(stored))
  }
  return (
    <CardForm
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      dirty={dirty}
      saving={save.isPending}
      onReset={reset}
      onSubmit={() => {
        if (!valid) {
          setTried(true)
          return
        }
        save.mutate(
          { free_shipping_threshold: wanted },
          {
            onSuccess: () => toast.success(t("settings.saved")),
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      <label
        htmlFor="free-shipping-on"
        className="flex cursor-pointer items-center justify-between gap-4"
      >
        <span className="text-sm font-medium">{t(`${S}.switch`)}</span>
        <Switch
          id="free-shipping-on"
          checked={on}
          disabled={save.isPending}
          onCheckedChange={setOn}
        />
      </label>
      {on ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="free-shipping-threshold" className="text-sm font-medium">
            {t(`${S}.threshold`)}
          </label>
          <NumberField
            decimals={2}
            min={0}
            className="w-44"
            suffix="₺"
            id="free-shipping-threshold"
            value={text}
            aria-invalid={!shown || undefined}
            aria-describedby={shown ? undefined : "free-shipping-threshold-error"}
            onChange={(event) => {
              setText(event.target.value)
            }}
          />
          {shown ? null : (
            <p id="free-shipping-threshold-error" className="text-[13px] text-destructive">
              {t(`${S}.thresholdInvalid`)}
            </p>
          )}
        </div>
      ) : null}
    </CardForm>
  )
}

/**
 * Settings > Shipping > "Ücretsiz kargo eşiği" (F4.5; the owner,
 * 2026-11-26: looked for it under shipping): free shipping from a basket
 * total, on every option (PR #441). Stored in the promotions section as
 * before; the promotions page shows it in a line and links here.
 */
export function FreeShippingCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<PromotionSettings>("promotions"))
  const box = useRef<HTMLDivElement>(null)
  const ready = section.data !== undefined
  useEffect(() => {
    if (ready && window.location.hash === `#${FREE_SHIPPING_ANCHOR}`) {
      box.current?.scrollIntoView({ block: "start" })
    }
  }, [ready])
  const stored = section.data?.values.free_shipping_threshold ?? null
  return (
    <div id={FREE_SHIPPING_ANCHOR} ref={box} className="scroll-mt-4">
      {section.data ? (
        <ThresholdForm key={String(stored)} stored={stored} />
      ) : section.isError ? (
        <ErrorState text={errorText(t, section.error)} onRetry={() => void section.refetch()} />
      ) : (
        <LoadingRows rows={2} />
      )}
    </div>
  )
}
