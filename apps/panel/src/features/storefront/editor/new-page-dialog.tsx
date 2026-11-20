import { Link } from "@tanstack/react-router"
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
import { looksLikeLegalText } from "@/features/content/legal-title"
import { errorText } from "@/lib/errors"
import { toSlug } from "@/lib/slug"

const N = "storefront.editor.contentPage.new"

/**
 * A new content page from the theme editor (adr/0073 Ek 2026-11-19 (2)
 * K5): its title, and its address made from the title (written over, or
 * left to the server, which takes a free one). Opened as a draft; the
 * editor picks it and gives it an empty page text.
 */
export function NewPageDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const create = useCreateContent()
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const close = () => {
    onOpenChange(false)
    setTitle("")
    setHandle("")
    setFailure(null)
  }
  const submit = () => {
    setFailure(null)
    const own = handle.trim()
    create.mutate(
      { kind: "page", title: title.trim(), ...(own ? { handle: own } : {}) },
      {
        onSuccess: ({ entry }) => {
          toast.success(t(`${N}.created`))
          close()
          onCreated(entry.id)
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
          <DialogTitle>{t(`${N}.title`)}</DialogTitle>
          <DialogDescription>{t(`${N}.description`)}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogBody>
            <Field label={t("content.fields.title")} htmlFor="new-page-title" required>
              <Input
                id="new-page-title"
                value={title}
                autoFocus
                maxLength={200}
                onChange={(event) => {
                  setTitle(event.target.value)
                }}
              />
            </Field>
            <Field
              label={t("content.fields.handle")}
              htmlFor="new-page-handle"
              hint={t(`${N}.handleHint`)}
              error={failure ?? undefined}
            >
              <div className="flex items-center rounded-md border">
                <span className="pl-3 font-mono text-[13px] text-muted-foreground">/</span>
                <Input
                  id="new-page-handle"
                  spellCheck={false}
                  value={handle}
                  placeholder={toSlug(title)}
                  className="border-0 pl-0 font-mono text-[13px] shadow-none"
                  onChange={(event) => {
                    setHandle(event.target.value)
                  }}
                />
              </div>
            </Field>
            {looksLikeLegalText(title) ? (
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
