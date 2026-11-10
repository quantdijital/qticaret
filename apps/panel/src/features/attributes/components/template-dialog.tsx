import { Trash2 } from "lucide-react"
import { useState } from "react"
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useDeleteTemplate, useSaveTemplate } from "@/features/attributes/api"
import { emptyDefinition, removedDefinitions, templateForm } from "@/features/attributes/form"
import type { TemplateForm } from "@/features/attributes/form"
import type { AttributeTemplate } from "@/features/attributes/types"
import { errorText } from "@/lib/errors"
import { isValidSlug, toSlug } from "@/lib/slug"
import { AddDefinitionButton, DefinitionEditor } from "./definition-editor"
import { GroupList } from "./group-list"

interface TemplateDialogProps {
  /** The template to edit; null for a new one. */
  template: AttributeTemplate | null
  /** A saved template's place among the shop's: ‹ n / m › walks them. */
  steps?: RecordSteps
  /** The template the arrows go to, by its place: the form starts again from it. */
  templateAt?: (index: number) => AttributeTemplate | undefined
  onClose: () => void
}

/**
 * A template and its attributes in one dialog (adr/0013): its name and
 * address, the spec table's groups and each attribute. Removing an
 * attribute that products may hold values for is asked about first; the
 * arrows go to the shop's next template, asking first when something is
 * not saved. `lg`: the name and the address side by side.
 */
export function TemplateDialog({ template, steps, templateAt, onClose }: TemplateDialogProps) {
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
  const guard = useDiscardGuard(form.formState.isDirty)
  const [pending, setPending] = useState<TemplateForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const send = (values: TemplateForm, confirm: boolean) => {
    save.mutate(
      { template, form: values, confirm },
      {
        onSuccess: () => {
          toast.success(t("attributes.saved"))
          onClose()
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
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        size="lg"
        pane="fixed"
        title={template ? template.name : t("attributes.newTemplate")}
        description={t("attributes.templateHint")}
        headerAction={
          template && steps ? (
            <RecordStepper
              {...steps}
              previousLabel={t("attributes.previousTemplate")}
              nextLabel={t("attributes.nextTemplate")}
              disabled={save.isPending}
              onGo={(to) => {
                const next = templateAt?.(to)
                if (next) {
                  guard.guard(() => {
                    form.reset(templateForm(next))
                    steps.onGo(to)
                  })
                }
              }}
            />
          ) : null
        }
        dirty={form.formState.isDirty}
        saving={save.isPending}
        onSubmit={() => void submit()}
        guard={guard}
        footerStart={
          template ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive-text sm:w-auto"
              onClick={() => {
                setConfirmDelete(true)
              }}
            >
              <Trash2 />
              {t("attributes.deleteTemplate")}
            </Button>
          ) : undefined
        }
      >
        <FormProvider {...form}>
          {/* Started again for another template: what the parts keep for themselves too */}
          <DialogBody key={template?.id ?? "new"}>
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
            <GroupList />
            <DialogSection title={t("attributes.definitions")}>
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
            </DialogSection>
          </DialogBody>
        </FormProvider>
      </FormDialog>
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
                onClose()
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        />
      ) : null}
    </>
  )
}
