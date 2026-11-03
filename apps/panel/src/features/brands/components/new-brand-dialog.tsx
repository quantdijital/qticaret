import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCreateBrand } from "@/features/brands/api/brands"
import { errorText } from "@/lib/errors"

/** A new brand by its name; its page, logo and text are set on its own page next. */
export function NewBrandDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateBrand()
  const [name, setName] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const close = () => {
    onOpenChange(false)
    setName("")
    setFailure(null)
  }
  const submit = () => {
    setFailure(null)
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: ({ brand }) => {
          toast.success(t("brands.created"))
          close()
          void navigate({ to: "/brands/$id", params: { id: brand.id } })
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
          <DialogTitle>{t("brands.add")}</DialogTitle>
          <DialogDescription>{t("brands.addHint")}</DialogDescription>
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
              label={t("brands.name")}
              htmlFor="brand-new-name"
              error={failure ?? undefined}
              required
            >
              <Input
                id="brand-new-name"
                value={name}
                autoFocus
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value)
                }}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || name.trim() === ""}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("brands.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
