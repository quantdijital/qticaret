import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useDeleteCategory, useUpdateCategory } from "@/features/categories/api/categories"
import type { Category } from "@/features/categories/api/categories"
import { ancestorHandles, descendantsOf, treeRows } from "@/features/categories/tree"
import { useCategoryPath } from "@/features/categories/use-category-path"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { isValidSlug, toSlug } from "@/lib/slug"

const ROOT = "__root__"

interface Values {
  name: string
  handle: string
  parent: string
  is_active: boolean
  is_internal: boolean
}

type Stored = Pick<Category, "name" | "handle" | "parent_category_id" | "is_active" | "is_internal">

const valuesOf = (category: Stored): Values => ({
  name: category.name,
  handle: category.handle,
  parent: category.parent_category_id ?? ROOT,
  is_active: category.is_active,
  is_internal: category.is_internal,
})

interface CategoryEditorProps {
  categories: Category[]
  category: Category
  onDeleted: () => void
}

/**
 * One category's name, address, place in the tree and visibility; deleting
 * it too. Its text is a card of its own (adr/0075): Medusa's category route
 * never gets it from here, or the text's document would go stale.
 */
export function CategoryEditor({ categories, category, onDeleted }: CategoryEditorProps) {
  const { t } = useTranslation()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pathOf = useCategoryPath()
  const saved = valuesOf(category)
  // A refetch (the tree, after any save) keeps what is being typed
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const [name, handle, parent] = useWatch({
    control: form.control,
    name: ["name", "handle", "parent"],
  })
  const { errors, isDirty } = form.formState
  const blocked = descendantsOf(categories, category.id).add(category.id)
  const parents = treeRows(categories, new Set()).filter((row) => !blocked.has(row.category.id))
  const slug = handle.trim() || toSlug(name)
  const path = pathOf([
    ...ancestorHandles(categories, parent === ROOT ? null : parent),
    slug || "…",
  ])

  const submit = form.handleSubmit((values) => {
    // What is typed while the save is on its way stays, and leaves the card dirty
    const settle = beginSave(form)
    const input = {
      name: values.name.trim(),
      ...(values.handle.trim() ? { handle: values.handle.trim() } : {}),
      parent_category_id: values.parent === ROOT ? null : values.parent,
      is_active: values.is_active,
      is_internal: values.is_internal,
    }
    update.mutate(
      { id: category.id, ...input },
      {
        onSuccess: ({ product_category }) => {
          settle(valuesOf(product_category))
          toast.success(t("categories.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  return (
    <CardForm
      title={t("categories.general")}
      description={t("categories.editHint")}
      dirty={isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field
        label={t("categories.name")}
        htmlFor="category-name"
        required
        error={errors.name ? t("categories.nameRequired") : undefined}
      >
        <Input
          placeholder={t("categories.placeholders.name")}
          id="category-name"
          {...form.register("name", { validate: (text) => text.trim().length >= 2 })}
        />
      </Field>
      <Field
        label={t("categories.url")}
        htmlFor="category-handle"
        hint={t("categories.urlHint")}
        error={errors.handle ? t("products.errors.handle") : undefined}
      >
        <Input
          id="category-handle"
          placeholder={toSlug(name)}
          spellCheck={false}
          className="font-mono text-[13px]"
          {...form.register("handle", {
            validate: (text) => text.trim() === "" || isValidSlug(text.trim()),
          })}
        />
        <p className="font-mono text-xs text-muted-foreground">{path}</p>
      </Field>
      <Field label={t("categories.parent")} htmlFor="category-parent">
        <Controller
          control={form.control}
          name="parent"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="category-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value={ROOT}>{t("categories.root")}</SelectItem>
                {parents.map(({ category: option, depth }) => (
                  <SelectItem key={option.id} value={option.id}>
                    {`${"— ".repeat(depth)}${option.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <div className="flex flex-col divide-y rounded-md border">
        {(["is_active", "is_internal"] as const).map((key) => (
          <label
            key={key}
            htmlFor={`category-${key}`}
            className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`categories.flags.${key}.title`)}</span>
              <span className="text-[13px] text-muted-foreground">
                {t(`categories.flags.${key}.description`)}
              </span>
            </span>
            <Controller
              control={form.control}
              name={key}
              render={({ field }) => (
                <Switch
                  id={`category-${key}`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </label>
        ))}
      </div>
      <div className="flex justify-start">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive-text"
          onClick={() => {
            setConfirmDelete(true)
          }}
        >
          <Trash2 />
          {t("categories.delete")}
        </Button>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("categories.deleteTitle", { name: category.name })}
          description={t("categories.deleteDescription")}
          confirmLabel={t("categories.delete")}
          destructive
          onConfirm={() => {
            remove.mutate(category.id, {
              onSuccess: () => {
                toast.success(t("categories.deleted"))
                onDeleted()
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        />
      </div>
    </CardForm>
  )
}
