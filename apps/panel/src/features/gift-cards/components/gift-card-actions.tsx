import { EllipsisVertical } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { closable, maskCode } from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"

/** What can be done to a card: closing it while something is left on it. */
export function GiftCardActions({
  card,
  onClose,
}: {
  card: GiftCard
  onClose: (card: GiftCard) => void
}) {
  const { t } = useTranslation()
  if (!closable(card)) {
    return null
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("giftCards.actions", { code: maskCode(card.code) })}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            onClose(card)
          }}
        >
          {t("giftCards.close.action")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
