import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { PickBox, VARIANT_COLUMNS } from "./variant-list-row"

const D = "products.variant"

/** The list's head: a box picking every variant, then the columns' names. */
export function VariantListHead({
  all,
  some,
  onPick,
}: {
  all: boolean
  some: boolean
  onPick: (on: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-stretch border-t bg-muted/60 sm:border-b">
      <PickBox
        checked={all ? true : some ? "indeterminate" : false}
        onChange={onPick}
        label={t(`${D}.bulk.pickAll`)}
      />
      <div
        aria-hidden="true"
        className={`${VARIANT_COLUMNS} flex-1 py-2 pr-5 text-xs font-medium text-muted-foreground`}
      >
        <span />
        <span>{t("products.wizard.variant")}</span>
        <span className="hidden sm:block">{t("products.wizard.price")}</span>
        <span className="hidden sm:block">{t("products.wizard.stock")}</span>
        <span className="hidden sm:block" />
        <span className="hidden sm:block" />
      </div>
    </div>
  )
}

/** A group's head: a box picking its variants (a bulk change for the group), its name and count. */
export function VariantGroupHead({
  label,
  count,
  open,
  picked,
  onToggle,
  onPick,
}: {
  label: string
  count: number
  open: boolean
  picked: number
  onToggle: () => void
  onPick: (on: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-stretch bg-muted/30">
      <PickBox
        checked={picked === count ? true : picked > 0 ? "indeterminate" : false}
        onChange={onPick}
        label={t(`${D}.bulk.pickGroup`, { name: label })}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 pr-5 text-left text-[13px] font-medium outline-hidden hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
          {t(`${D}.groupCount`, { count })}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </span>
      </button>
    </div>
  )
}
