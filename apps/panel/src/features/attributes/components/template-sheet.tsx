import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useDeleteTemplate, useSaveTemplate } from "@/features/attributes/api"
import { emptyDefinition, removedDefinitions, templateForm } from "@/features/attributes/form"
import type { TemplateForm } from "@/features/attributes/form"
import type { AttributeTemplate } from "@/features/attributes/types"
import { errorText } from "@/lib/errors"
import { isValidSlug, toSlug } from "@/lib/slug"
import { AddDefinitionButton, DefinitionEditor } from "./definition-editor"

interface TemplateSheetProps {
  /** The template to edit; null for a new one. */
  template: AttributeTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A template and its attributes in a side sheet (adr/0013). Removing an
 * attribute that products may hold values for is asked about first.
 */
export function TemplateSheet({ template, open, onOpenChange }: TemplateSheetProps) {
  const { t } = useTranslation()
  const form = useForm<TemplateForm>({ defaultValues: templateForm(template) })
  const definitions = useFieldArray({
    control: form.control,
    name: "definitions",
    keyName: "fieldKey",
  })
  const name = useWatch({ control: form.control, name: "name" })
  const save = useSaveTemplate()
  const remove = useDeleteTemplate()
  const [pending, setPending] = useState<TemplateForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const send = (values: TemplateForm, confirm: boolean) => {
    save.mutate(
      { id: template?.id ?? null, form: values, confirm },
      {
        onSuccess: () => {
          toast.success(t("attributes.saved"))
          onOpenChange(false)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const submit = form.handleSubmit((values) => {
    const handle = values.handle.trim() || toSlug(values.name)
    if (!values.name.trim() || (!template && !isValidSlug(handle))) {
      toast.error(t("attributes.nameRequired"))
      return
    }
    const next = { ...values, handle }
    if (removedDefinitions(template, next).length > 0) {
      setPending(next)
    } else {
      send(next, false)
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{template ? template.name : t("attributes.newTemplate")}</SheetTitle>
          <SheetDescription>{t("attributes.templateHint")}</SheetDescription>
        </SheetHeader>
        <FormProvider {...form}>
          <form
            id="template-form"
            noValidate
            onSubmit={(event) => {
              void submit(event)
            }}
            className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("attributes.templateName")} htmlFor="template-name" required>
                <Input id="template-name" {...form.register("name")} />
              </Field>
              <Field
                label={t("attributes.handle")}
                htmlFor="template-handle"
                hint={t("attributes.handleHint")}
              >
                <Input
                  id="template-handle"
                  placeholder={toSlug(name)}
                  disabled={template !== null}
                  className="font-mono text-[13px]"
                  {...form.register("handle")}
                />
              </Field>
            </div>
            <Field label={t("attributes.description")} htmlFor="template-description">
              <Textarea
                id="template-description"
                className="min-h-16"
                {...form.register("description")}
              />
            </Field>
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">{t("attributes.definitions")}</span>
              {definitions.fields.length === 0 ? (
                <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("attributes.noDefinitions")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {definitions.fields.map((field, index) => (
                    <DefinitionEditor
                      key={field.fieldKey}
                      index={index}
                      count={definitions.fields.length}
                      onMove={(step) => {
                        definitions.move(index, index + step)
                      }}
                      onRemove={() => {
                        definitions.remove(index)
                      }}
                    />
                  ))}
                </ul>
              )}
              <AddDefinitionButton
                onAdd={() => {
                  definitions.append(emptyDefinition())
                }}
              />
            </div>
          </form>
        </FormProvider>
        <SheetFooter className="flex-row items-center justify-between border-t">
          {template ? (
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
              {t("attributes.deleteTemplate")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" form="template-form" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPending(null)
          }
        }}
        title={t("attributes.removeValuesTitle")}
        description={t("attributes.removeValuesDescription", {
          names: pending
            ? removedDefinitions(template, pending)
                .map((item) => item.label)
                .join(", ")
            : "",
        })}
        confirmLabel={t("attributes.removeValuesConfirm")}
        destructive
        onConfirm={() => {
          if (pending) {
            send(pending, true)
          }
          setPending(null)
        }}
      />
      {template ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("attributes.deleteTitle", { name: template.name })}
          description={t("attributes.deleteDescription")}
          confirmLabel={t("attributes.deleteTemplate")}
          destructive
          onConfirm={() => {
            remove.mutate(template.id, {
              onSuccess: () => {
                toast.success(t("attributes.deleted"))
                onOpenChange(false)
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        />
      ) : null}
    </Sheet>
  )
}
