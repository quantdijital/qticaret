import { useNavigate } from "@tanstack/react-router"
import { Ban, CirclePause, CirclePlay, Copy, MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
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
import {
  useBulkAction,
  useCopyBulkMessage,
  useDeleteBulkMessage,
} from "@/features/bulk-messages/api/bulk-messages"
import type { BulkAction } from "@/features/bulk-messages/api/bulk-messages"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { errorText } from "@/lib/errors"

const A = "bulkMessages.actions"

type Asked = "resume" | "cancel" | "delete" | null

/**
 * What a campaign allows where it stands (adr/0050 §2, §6): a draft is
 * deleted, a sending one paused, a paused one resumed, any that has not
 * ended cancelled, and every one copied into a new draft. Cancel, resume
 * and delete are asked once more; the backend wants no proof for them.
 */
export function BulkActions({ campaign }: { campaign: BulkMessage }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const act = useBulkAction(campaign.id)
  const copy = useCopyBulkMessage(campaign.id)
  const remove = useDeleteBulkMessage(campaign.id)
  const [asked, setAsked] = useState<Asked>(null)
  const { status } = campaign
  const cancellable = status === "scheduled" || status === "sending" || status === "paused"
  const busy = act.isPending || copy.isPending || remove.isPending
  const run = (action: BulkAction) => {
    act.mutate(action, {
      onSuccess: () => toast.success(t(`${A}.done.${action}`)),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const confirm = () => {
    const current = asked
    setAsked(null)
    if (current === "delete") {
      remove.mutate(undefined, {
        onSuccess: () => {
          toast.success(t(`${A}.done.delete`))
          void navigate({ to: "/bulk-messages" })
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      })
    } else if (current) {
      run(current)
    }
  }
  return (
    <div className="flex items-center gap-2">
      {status === "sending" ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            run("pause")
          }}
        >
          <CirclePause />
          {t(`${A}.pause`)}
        </Button>
      ) : null}
      {status === "paused" ? (
        <Button
          disabled={busy}
          onClick={() => {
            setAsked("resume")
          }}
        >
          <CirclePlay />
          {t(`${A}.resume`)}
        </Button>
      ) : null}
      {cancellable ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setAsked("cancel")
          }}
        >
          <Ban />
          {t(`${A}.cancel`)}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("common.more")} disabled={busy}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              copy.mutate(undefined, {
                onSuccess: (created) => {
                  toast.success(t(`${A}.done.copy`))
                  void navigate({ to: "/bulk-messages/$id", params: { id: created.id } })
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              })
            }}
          >
            <Copy />
            {t(`${A}.copy`)}
          </DropdownMenuItem>
          {status === "draft" ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                setAsked("delete")
              }}
            >
              <Trash2 />
              {t(`${A}.delete`)}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAsked(null)
          }
        }}
        title={asked ? t(`${A}.confirm.${asked}.title`, { name: campaign.name }) : ""}
        description={asked ? t(`${A}.confirm.${asked}.description`) : ""}
        confirmLabel={asked ? t(`${A}.${asked}`) : ""}
        destructive={asked === "cancel" || asked === "delete"}
        onConfirm={confirm}
      />
    </div>
  )
}
