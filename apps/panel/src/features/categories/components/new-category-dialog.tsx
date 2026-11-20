import { useQuery } from "@tanstack/react-query"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { categoryTreeQuery, useCreateCategory } from "@/features/categories/api/categories"
import { treeRows } from "@/features/categories/tree"
import { errorText } from "@/lib/errors"

const ROOT = "__root__"

/**
 * A new category by its name and place in the tree; its address comes
 * from the name, and its text, picture and search appearance are set on
 * its own page next.
 */
export function NewCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tree = useQuery(categoryTreeQuery())
  const create = useCreateCategory()
  const [name, setName] = useState("")
  const [parent, setParent] = useState(ROOT)
  const [failure, setFailure] = useState<string | null>(null)
  const parents = treeRows(tree.data ?? [], new Set())
  const valid = name.trim().length >= 2
  const close = () => {
    onOpenChange(false)
    setName("")
    setParent(ROOT)
    setFailure(null)
  }
  const submit = () => {
    setFailure(null)
    create.mutate(
      {
        name: name.trim(),
        description: "",
        parent_category_id: parent === ROOT ? null : parent,
        is_active: true,
        is_internal: false,
      },
      {
        onSuccess: (category) => {
          toast.success(t("categories.created"))
          close()
          void navigate({ to: "/categories/$id", params: { id: category.id } })
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
          <DialogTitle>{t("categories.add")}</DialogTitle>
          <DialogDescription>{t("categories.addHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) {
              submit()
            }
          }}
        >
          <DialogBody>
            <Field
              label={t("categories.name")}
              htmlFor="category-new-name"
              error={failure ?? undefined}
              required
            >
              <Input
                id="category-new-name"
                value={name}
                autoFocus
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value)
                }}
              />
            </Field>
            <Field label={t("categories.parent")} htmlFor="category-new-parent">
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger id="category-new-parent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={ROOT}>{t("categories.root")}</SelectItem>
                  {parents.map(({ category, depth }) => (
                    <SelectItem key={category.id} value={category.id}>
                      {`${"— ".repeat(depth)}${category.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="cancel" disabled={create.isPending} onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || !valid}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("categories.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
