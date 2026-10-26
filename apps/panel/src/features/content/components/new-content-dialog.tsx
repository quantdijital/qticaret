import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCreateContent } from "@/features/content/api/content"
import type { ContentKind } from "@/features/content/api/content"
import { errorText } from "@/lib/errors"

/** A new page or post by its title, as a draft; it is written on its own page next. */
export function NewContentDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: ContentKind
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateContent()
  const [title, setTitle] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const close = () => {
    onOpenChange(false)
    setTitle("")
    setFailure(null)
  }
  const submit = () => {
    setFailure(null)
    create.mutate(
      { kind, title: title.trim() },
      {
        onSuccess: ({ entry }) => {
          toast.success(t(`content.created.${kind}`))
          close()
          void navigate({ to: "/content/$id", params: { id: entry.id } })
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`content.add.${kind}`)}</DialogTitle>
          <DialogDescription>{t("content.addHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Field
            label={t("content.fields.title")}
            htmlFor="content-new-title"
            error={failure ?? undefined}
            required
          >
            <Input
              id="content-new-title"
              value={title}
              autoFocus
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value)
              }}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || title.trim() === ""}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("content.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
