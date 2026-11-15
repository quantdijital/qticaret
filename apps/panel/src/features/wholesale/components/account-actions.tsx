import type { TFunction } from "i18next"
import { KeyRound, Pencil, Power, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useSetAccountState } from "@/features/wholesale/api/accounts"
import type { CartsRepriced, WholesaleAccount } from "@/features/wholesale/api/types"
import { errorText } from "@/lib/errors"
import { AccountEditDialog } from "./account-edit-dialog"
import { PasswordDialog } from "./password-dialog"

const A = "wholesale.actions"

type Confirming = "deactivate" | "reactivate" | null

/** What a state change did to the open carts, in words; a cart not priced again is a warning. */
function announceCarts(t: TFunction, done: string, carts: CartsRepriced) {
  const repriced =
    carts.repriced > 0 ? ` ${t(`${A}.cartsRepriced`, { count: carts.repriced })}` : ""
  toast.success(`${done}${repriced}`)
  if (carts.failed > 0) {
    toast.warning(t(`${A}.cartsFailed`, { count: carts.failed }))
  }
}

/**
 * The wholesaler's actions (ADR-0068 §3, Ek 2026-11-15 (2)): edit, a new
 * password where staff made or took over the sign-in (an open account),
 * close an active one or open a closed one
 * again. Each state change asks first and says what it did to the
 * customer's open carts. No invitation is sent any more.
 */
export function AccountActions({ account }: { account: WholesaleAccount }) {
  const { t } = useTranslation()
  const state = useSetAccountState(account.id)
  const [editing, setEditing] = useState(false)
  const [password, setPassword] = useState(false)
  const [confirming, setConfirming] = useState<Confirming>(null)
  // Only a sign-in staff made or took over, on an open account (review M4)
  const settable = account.staff_login && account.status === "active" && account.customer !== null
  const change = (to: "deactivate" | "reactivate") => {
    state.mutate(to, {
      onSuccess: ({ carts }) => {
        announceCarts(t, t(`${A}.${to}d`), carts)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setEditing(true)
        }}
      >
        <Pencil />
        {t("common.edit")}
      </Button>
      {settable ? (
        <Button
          variant="outline"
          onClick={() => {
            setPassword(true)
          }}
        >
          <KeyRound />
          {t(`${A}.password`)}
        </Button>
      ) : null}
      {account.status === "active" ? (
        <Button
          variant="outline"
          disabled={state.isPending}
          onClick={() => {
            setConfirming("deactivate")
          }}
        >
          <Power />
          {t(`${A}.deactivate`)}
        </Button>
      ) : account.status === "inactive" ? (
        <Button
          disabled={state.isPending}
          onClick={() => {
            setConfirming("reactivate")
          }}
        >
          <RotateCcw />
          {t(`${A}.reactivate`)}
        </Button>
      ) : null}
      <AccountEditDialog account={account} open={editing} onOpenChange={setEditing} />
      {settable ? (
        <PasswordDialog account={account} open={password} onOpenChange={setPassword} />
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null)
          }
        }}
        title={confirming ? t(`${A}.${confirming}Title`) : ""}
        description={confirming ? t(`${A}.${confirming}Text`) : ""}
        confirmLabel={confirming ? t(`${A}.${confirming}`) : ""}
        destructive={confirming === "deactivate"}
        onConfirm={() => {
          if (confirming) {
            change(confirming)
          }
        }}
      />
    </>
  )
}
