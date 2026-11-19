import { Link, useNavigate } from "@tanstack/react-router"
import { Loader2, Scale } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
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
import { useCreateContent } from "@/features/content/api/content"
import type { ContentKind } from "@/features/content/api/content"
import { looksLikeLegalText } from "@/features/content/legal-title"
import { errorText } from "@/lib/errors"

/**
 * A new page or post by its title, as a draft; it is written on its own page
 * next. A page titled like a legal text points to Settings > Legal, where
 * those are made from the shop's details (it does not stop the page).
 */
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
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`content.add.${kind}`)}</DialogTitle>
          <DialogDescription>{t("content.addHint")}</DialogDescription>
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
            {kind === "page" && looksLikeLegalText(title) ? (
              <Alert>
                <Scale aria-hidden="true" />
                <AlertTitle>{t("content.legal.title")}</AlertTitle>
                <AlertDescription>
                  <p>{t("content.legal.text")}</p>
                  <Link to="/settings/legal" className="font-medium underline underline-offset-4">
                    {t("content.legal.link")}
                  </Link>
                </AlertDescription>
              </Alert>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="cancel" disabled={create.isPending} onClick={close}>
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
