import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { CollapsibleSection } from "@qticaret/admin-ui/patterns/collapsible-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { ShopShippingOption } from "@/features/settings/api/shipping-options"
import { shippingClassUsageQuery } from "@/features/settings/api/shipping-classes"
import { ShippingOptionEditor } from "@/features/settings/components/shipping-option-editor"
import { useFirstCarrier } from "@/features/settings/use-first-carrier"

const S = "settings.shipping.options"

/** How shoppers pay for it, in a few words: the amount, or where the price comes from. */
function priceText(t: (key: string) => string, option: ShopShippingOption): string {
  if (option.pricing === "flat") {
    return Number(option.amount ?? 0) === 0
      ? t(`${S}.free`)
      : formatMoney(option.amount ?? "0", "try")
  }
  return t(`${S}.pricings.${option.pricing}`)
}

/** One option: its name, carrier and price; a press opens it for editing in place. */
function OptionRow({
  option,
  open,
  onToggle,
}: {
  option: ShopShippingOption
  open: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const body = `shipping-option-${option.id}`
  return (
    <li className="border-t px-5 py-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={body}
        aria-label={t(`${S}.edit`, { name: option.name })}
        onClick={onToggle}
        className="group flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-sm py-0.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid [html[data-input=pointer]_&]:outline-none"
      >
        <span className="flex min-w-0 flex-[1_1_12rem] flex-col gap-0.5">
          <span className="text-sm font-medium">{option.name}</span>
          <span className="text-[13px] text-muted-foreground">
            {t(`${S}.carriers.${option.carrier ?? "manual"}`)}
          </span>
        </span>
        <span className="text-sm tabular-nums">{priceText(t, option)}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground group-hover:text-foreground",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div id={body}>
          <ShippingOptionEditor option={option} onDone={onToggle} />
        </div>
      ) : null}
    </li>
  )
}

/**
 * Settings > Shipping > "Ek kargo seçenekleri" (F7.8; the owner,
 * 2026-11-26: the fee is one question, the rest is extra): the options
 * beside the main one ("Hızlı kargo", pickup), folded to a line; each
 * opens in its own row to rename, reprice or remove; a new one starts
 * filled in, at the foot of the list. While the fee is custom (one answer
 * cannot say it) every option is here, the main one too, and it opens.
 */
export function ShippingOptionsCard({
  options,
  custom,
}: {
  options: readonly ShopShippingOption[]
  custom: boolean
}) {
  const { t } = useTranslation()
  const firstCarrier = useFirstCarrier()
  const [open, setOpen] = useState<string | null>(null)
  // adr/0087 §4: a class or a free-shipping product changes every option's price
  const classesInUse = Object.keys(useQuery(shippingClassUsageQuery()).data ?? {}).length > 0
  const toggle = (id: string) => {
    setOpen((current) => (current === id ? null : id))
  }
  const summary =
    options.length === 0
      ? t(`${S}.noExtras`)
      : options.map((option) => `${option.name} · ${priceText(t, option)}`).join(", ")
  return (
    <CollapsibleSection
      id="shipping-extras"
      name="settings.shipping.extras"
      title={t(custom ? `${S}.allTitle` : `${S}.title`)}
      description={t(`${S}.description`)}
      summary={summary}
      attention={custom}
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={open === "new"}
          onClick={() => {
            setOpen("new")
          }}
        >
          <Plus />
          {t(`${S}.add`)}
        </Button>
      }
      className="[&>div]:px-0 [&>div]:pb-0"
    >
      <ul>
        {options.length === 0 && open !== "new" ? (
          <li className="border-t px-5 py-4 text-[13px] text-muted-foreground">
            {t(`${S}.noExtras`)}
          </li>
        ) : null}
        {options.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            open={open === option.id}
            onToggle={() => {
              toggle(option.id)
            }}
          />
        ))}
        {open === "new" ? (
          <li className="border-t px-5 pb-4">
            <ShippingOptionEditor
              carrier={firstCarrier}
              onDone={() => {
                setOpen(null)
              }}
            />
          </li>
        ) : null}
      </ul>
      {classesInUse ? (
        <p className="border-t px-5 py-3 text-[13px] text-muted-foreground">
          {t("settings.shipping.classes.optionsNote")}
        </p>
      ) : null}
    </CollapsibleSection>
  )
}
