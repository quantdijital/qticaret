import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { SwitchName } from "./hint-parts"

interface GiftCardFieldProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Why marking it was refused (the shop's gift cards are off), with where to turn them on. */
  failure: string | null
}

/**
 * The product sells gift cards (adr/0025 Ek 2026-11-03): its variants are
 * the amounts, a paid unit issues a card e-mailed to its recipient. Marked,
 * the server makes it digital (no shipping). Medusa's own gift card mark
 * is never sent: the server refuses it.
 */
export function GiftCardField({ checked, onCheckedChange, failure }: GiftCardFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <SwitchName
          htmlFor="catalog-gift-card"
          label={t("products.catalog.giftCard")}
          hint={t("products.catalog.giftCardHint")}
          hintId="catalog-gift-card-hint"
        />
        <Switch
          id="catalog-gift-card"
          aria-describedby="catalog-gift-card-hint"
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {failure ? (
        <p
          role="alert"
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md bg-destructive-soft px-3 py-2 text-[13px] text-destructive-text"
        >
          <span>{failure}</span>
          <Link to="/settings/features" className="font-medium underline underline-offset-4">
            {t("products.catalog.giftCardFeatures")}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
