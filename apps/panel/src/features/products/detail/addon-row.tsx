import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { formatMoney } from "@/lib/format"
import { priceRange } from "./addon-values"
import type { AddonValue } from "./addon-values"

const A = "products.addons"

/** What a shopper pays for it: free, one price, or the choices' range. */
function usePriceText(value: AddonValue): string {
  const { t } = useTranslation()
  const [low, high] = priceRange(value)
  if (high === 0) {
    return t(`${A}.free`)
  }
  const plus = (amount: number) => `+${formatMoney(amount, "try")}`
  return low === high ? plus(low) : `${plus(low)} – ${plus(high)}`
}

function IconButton({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      className={danger ? "text-destructive-text" : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

interface AddonRowProps {
  value: AddonValue
  index: number
  count: number
  /** The shop's add-ons are off: shown, not changed. */
  readOnly: boolean
  onMove: (to: number) => void
  onEdit: () => void
  onRemove: () => void
}

/** One add-on in the card: its name, kind, price and rules, and where it goes in the list. */
export function AddonRow({
  value,
  index,
  count,
  readOnly,
  onMove,
  onEdit,
  onRemove,
}: AddonRowProps) {
  const { t } = useTranslation()
  const price = usePriceText(value)
  const item = value.label
  const facts = [
    t(`${A}.kinds.${value.kind}`),
    price,
    value.required ? t(`${A}.requiredShort`) : null,
    value.kind === "text"
      ? t(`${A}.rules.${value.charset}`, { count: value.max_length })
      : t(`${A}.choiceCount`, { count: value.choices.length }),
    value.max_quantity === null ? null : t(`${A}.limitShort`, { count: value.max_quantity }),
  ]
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="min-w-0 break-words">{value.label}</span>
          {value.non_withdrawable ? <NonWithdrawableBadge /> : null}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {facts.filter(Boolean).join(" · ")}
        </span>
      </div>
      {readOnly ? null : (
        <div className="flex shrink-0 gap-1">
          <IconButton
            label={t(`${A}.moveUp`, { item })}
            disabled={index === 0}
            onClick={() => {
              onMove(index - 1)
            }}
          >
            <ChevronUp />
          </IconButton>
          <IconButton
            label={t(`${A}.moveDown`, { item })}
            disabled={index === count - 1}
            onClick={() => {
              onMove(index + 1)
            }}
          >
            <ChevronDown />
          </IconButton>
          <IconButton label={t(`${A}.edit`, { item })} onClick={onEdit}>
            <Pencil />
          </IconButton>
          <IconButton label={t(`${A}.remove`, { item })} danger onClick={onRemove}>
            <Trash2 />
          </IconButton>
        </div>
      )}
    </li>
  )
}
