import { MoreHorizontal, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { useDeleteAccount } from "@/features/wholesale/api/accounts"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { accountTitle } from "@/features/wholesale/format"
import { errorText } from "@/lib/errors"

const A = "wholesale.actions"

/**
 * A wholesaler deleted after asking (Ek 2026-11-15 (2)): the wholesale
 * side goes, the customer stays a retail customer and past orders stay
 * wholesale orders; the dialog says so. The result's carts in words, a
 * cart not priced again a warning.
 */
export function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
  onDeleted,
}: {
  account: WholesaleAccount
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const remove = useDeleteAccount(account.id)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${A}.deleteTitle`, { name: accountTitle(account) })}
      description={t(account.customer ? `${A}.deleteText` : `${A}.deletePendingText`)}
      confirmLabel={t(`${A}.delete`)}
      destructive
      onConfirm={() => {
        remove.mutate(undefined, {
          onSuccess: ({ carts }) => {
            const repriced =
              carts.repriced > 0 ? ` ${t(`${A}.cartsRepriced`, { count: carts.repriced })}` : ""
            toast.success(`${t(`${A}.deleted`)}${repriced}`)
            if (carts.failed > 0) {
              toast.warning(t(`${A}.cartsFailed`, { count: carts.failed }))
            }
            onDeleted?.()
          },
          onError: (failure) => toast.error(errorText(t, failure)),
        })
      }}
    />
  )
}

/** A row's menu on the wholesalers' list: "Sil". */
export function AccountRowMenu({ onDelete, name }: { onDelete: () => void; name: string }) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t(`${A}.more`, { name })}
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          {t(`${A}.delete`)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
