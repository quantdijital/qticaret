import { useTranslation } from "react-i18next"
import { ArrowDown, ArrowUp } from "lucide-react"
import { PAYMENT_BADGES } from "@qticaret/types"
import type { PaymentBadge } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"

const F = "storefront.editor.footerBar.payment_badges"

/**
 * The ways to pay the footer names (adr/0049 Ek 2026-11-15): the picked
 * ones first, in the order the storefront shows them, each moved up or
 * down; the rest after them. Picking one adds it at the end; none picked:
 * the theme shows the marks of the shop's payment providers, as before.
 */
export function PaymentBadgesField({
  id,
  value,
  onChange,
}: {
  id: string
  value: readonly PaymentBadge[]
  onChange: (badges: PaymentBadge[]) => void
}) {
  const { t } = useTranslation()
  const picked = value.filter((badge, index) => value.indexOf(badge) === index)
  const rest = PAYMENT_BADGES.filter((badge) => !picked.includes(badge))
  const move = (from: number, to: number) => {
    const next = [...picked]
    const [badge] = next.splice(from, 1)
    if (badge !== undefined) next.splice(to, 0, badge)
    onChange(next)
  }
  return (
    <fieldset id={id} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">
        {t(`${F}.label`)}{" "}
        <small className="text-[11px] font-normal text-muted-foreground">{t(`${F}.term`)}</small>
      </legend>
      <ul className="flex flex-col gap-1">
        {[...picked, ...rest].map((badge) => {
          const at = picked.indexOf(badge)
          const name = t(`${F}.${badge}`)
          const boxId = `${id}-${badge}`
          return (
            <li key={badge} className="flex min-h-8 items-center gap-2">
              <Checkbox
                id={boxId}
                checked={at >= 0}
                onCheckedChange={(checked) => {
                  onChange(
                    checked === true ? [...picked, badge] : picked.filter((each) => each !== badge)
                  )
                }}
              />
              <label htmlFor={boxId} className="flex-1 text-sm">
                {name}
              </label>
              {at >= 0 ? (
                <span className="flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t(`${F}.up`, { name })}
                    disabled={at === 0}
                    onClick={() => {
                      move(at, at - 1)
                    }}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t(`${F}.down`, { name })}
                    disabled={at === picked.length - 1}
                    onClick={() => {
                      move(at, at + 1)
                    }}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t(`${F}.hint`)}</p>
    </fieldset>
  )
}
