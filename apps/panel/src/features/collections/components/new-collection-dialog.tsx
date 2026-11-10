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
import { useCreateCollection } from "@/features/collections/api/collections"
import { errorText } from "@/lib/errors"

/** A new collection by its title; its page, picture, text and products are set on its own page next. */
export function NewCollectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateCollection()
  const [title, setTitle] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const close = () => {
    onOpenChange(false)
    setTitle("")
    setFailure(null)
  }
  const submit = () => {
    setFailure(null)
    create.mutate(title.trim(), {
      onSuccess: (collection) => {
        toast.success(t("collections.created"))
        close()
        void navigate({ to: "/collections/$id", params: { id: collection.id } })
      },
      onError: (error) => {
        setFailure(errorText(t, error))
      },
    })
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
          <DialogTitle>{t("collections.add")}</DialogTitle>
          <DialogDescription>{t("collections.addHint")}</DialogDescription>
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
              label={t("collections.name")}
              htmlFor="collection-new-title"
              error={failure ?? undefined}
              required
            >
              <Input
                id="collection-new-title"
                value={title}
                autoFocus
                maxLength={200}
                onChange={(event) => {
                  setTitle(event.target.value)
                }}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || title.trim() === ""}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("collections.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
