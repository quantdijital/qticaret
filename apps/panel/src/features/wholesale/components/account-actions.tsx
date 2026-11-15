import type { TFunction } from "i18next"
import { useNavigate } from "@tanstack/react-router"
import { Pencil, Power, RotateCcw, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  useDeleteAccount,
  useResendInvitation,
  useSetAccountState,
} from "@/features/wholesale/api/accounts"
import type { CartsRepriced, WholesaleAccount } from "@/features/wholesale/api/types"
import { errorText } from "@/lib/errors"
import { AccountEditDialog } from "./account-edit-dialog"

const A = "wholesale.actions"

type Confirming = "deactivate" | "reactivate" | "delete" | null

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
 * The wholesaler's actions (ADR-0068 §3), the next step first: a pending
 * one's invitation sent again (or taken back), an active one closed, a
 * closed one opened again. Each state change asks first and says what it
 * did to the customer's open carts.
 */
export function AccountActions({ account }: { account: WholesaleAccount }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useSetAccountState(account.id)
  const resend = useResendInvitation(account.id)
  const remove = useDeleteAccount(account.id)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const change = (to: "deactivate" | "reactivate") => {
    state.mutate(to, {
      onSuccess: ({ carts }) => {
        announceCarts(t, t(`${A}.${to}d`), carts)
      },
      onError: failed,
    })
  }
  const confirmed = () => {
    if (confirming === "delete") {
      remove.mutate(undefined, {
        onSuccess: () => {
          toast.success(t(`${A}.deleted`))
          void navigate({ to: "/customers/wholesale" })
        },
        onError: failed,
      })
    } else if (confirming) {
      change(confirming)
    }
  }
  const busy = state.isPending || resend.isPending || remove.isPending
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
      {account.status === "pending" ? (
        <>
          <Button
            disabled={busy}
            onClick={() => {
              resend.mutate(undefined, {
                onSuccess: ({ message }) => {
                  if (message === "sent") {
                    toast.success(t(`${A}.resent`))
                  } else {
                    toast.warning(t(`${A}.resendNotSent`))
                  }
                },
                onError: failed,
              })
            }}
          >
            <Send />
            {t(`${A}.resend`)}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t(`${A}.delete`)}
            disabled={busy}
            onClick={() => {
              setConfirming("delete")
            }}
          >
            <Trash2 />
          </Button>
        </>
      ) : account.status === "active" ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setConfirming("deactivate")
          }}
        >
          <Power />
          {t(`${A}.deactivate`)}
        </Button>
      ) : (
        <Button
          disabled={busy}
          onClick={() => {
            setConfirming("reactivate")
          }}
        >
          <RotateCcw />
          {t(`${A}.reactivate`)}
        </Button>
      )}
      <AccountEditDialog account={account} open={editing} onOpenChange={setEditing} />
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
        destructive={confirming !== "reactivate"}
        onConfirm={confirmed}
      />
    </>
  )
}
