import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useCreateBulkMessage } from "@/features/bulk-messages/api/bulk-messages"
import type { BulkChannel } from "@/features/bulk-messages/api/types"
import { ChannelPicker } from "@/features/bulk-messages/components/channel-picker"
import { LIMITS } from "@/features/bulk-messages/form"
import { errorText } from "@/lib/errors"

const C = "bulkMessages.create"

/**
 * "Yeni ileti": a draft by its name and channel, written on its own page
 * next. The server wants an audience from the start: every consented
 * customer, which the next page changes.
 */
export function NewBulkMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateBulkMessage()
  const [name, setName] = useState("")
  const [channel, setChannel] = useState<BulkChannel>("email")
  const [failure, setFailure] = useState<string | null>(null)
  const close = () => {
    onOpenChange(false)
    setName("")
    setChannel("email")
    setFailure(null)
  }
  const submit = () => {
    setFailure(null)
    create.mutate(
      { name: name.trim(), channel, audience: [{ kind: "all_consented" }] },
      {
        onSuccess: (campaign) => {
          toast.success(t(`${C}.created`))
          close()
          void navigate({ to: "/bulk-messages/$id", params: { id: campaign.id } })
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`${C}.title`)}</DialogTitle>
          <DialogDescription>{t(`${C}.hint`)}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogBody>
            <Field
              label={t("bulkMessages.fields.name")}
              htmlFor="bulk-new-name"
              hint={t("bulkMessages.fields.nameHint")}
              error={failure ?? undefined}
              required
            >
              <Input
                id="bulk-new-name"
                value={name}
                autoFocus
                maxLength={LIMITS.name}
                onChange={(event) => {
                  setName(event.target.value)
                }}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span id="bulk-new-channel" className="text-sm font-medium">
                {t("bulkMessages.fields.channel")}
              </span>
              <ChannelPicker value={channel} onChange={setChannel} labelledBy="bulk-new-channel" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || name.trim() === ""}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${C}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
