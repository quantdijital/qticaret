import { MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { VatRate } from "@/features/settings/api/vat-rates"
import { formatCount } from "@/lib/format"

const V = "settings.vatRates"

interface VatRateMenuProps {
  rate: VatRate
  isDefault: boolean
  onRename: () => void
  onMakeDefault: () => void
  onRemove: () => void
  onRestore: () => void
}

/**
 * A rate's actions, the owner's: renamed, made the default, removed (not
 * the default, not while products are on it; the menu says why) or, once
 * removed, brought back.
 */
export function VatRateMenu({
  rate,
  isDefault,
  onRename,
  onMakeDefault,
  onRemove,
  onRestore,
}: VatRateMenuProps) {
  const { t } = useTranslation()
  const blocked = isDefault
    ? t(`${V}.removeDefault`)
    : rate.products > 0
      ? t(`${V}.removeInUse`, { shown: formatCount(rate.products) })
      : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t(`${V}.actions`, { name: rate.name })}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {rate.active ? (
          <>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              {t(`${V}.rename`)}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isDefault} onSelect={onMakeDefault}>
              <Star />
              {t(`${V}.makeDefault`)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={blocked !== null}
              onSelect={onRemove}
              className="items-start"
            >
              <Trash2 className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                {t(`${V}.remove`)}
                {blocked ? <span className="text-xs text-muted-foreground">{blocked}</span> : null}
              </span>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={onRestore}>
            <RotateCcw />
            {t(`${V}.restore`)}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
