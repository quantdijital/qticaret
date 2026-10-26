import { Button, Drawer, Input, Label, Text, Textarea } from "@medusajs/ui"
import { useEffect } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toSlug } from "../../../../lib/seo/slug"
import type { AttributeTemplate } from "../../../lib/attributes"
import { DefinitionFields } from "./definition-fields"
import { emptyDefinition, templateForm } from "./form"
import type { TemplateForm } from "./form"
import { useTemplateSave } from "./use-template-save"

interface TemplateEditorProps {
  /** The template to edit; none to create one. */
  template?: AttributeTemplate | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Creates or edits an attribute template and its attributes (adr/0013). */
export function TemplateEditor({ template, open, onOpenChange }: TemplateEditorProps) {
  const { t } = useTranslation()
  const form = useForm<TemplateForm>({ defaultValues: templateForm(template) })
  const definitions = useFieldArray({ control: form.control, name: "definitions" })
  const save = useTemplateSave(template, () => {
    onOpenChange(false)
  })
  useEffect(() => {
    if (open) {
      form.reset(templateForm(template))
    }
  }, [open, template, form])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form
          className="flex h-full flex-col overflow-hidden"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              save.mutate(values)
            })(event)
          }}
        >
          <Drawer.Header>
            <Drawer.Title>
              {template
                ? t("qticaret.attributeTemplates.editTitle")
                : t("qticaret.attributeTemplates.createTitle")}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            <Text size="small" className="text-ui-fg-subtle">
              {t("qticaret.attributeTemplates.publicWarning")}
            </Text>
            <Controller
              control={form.control}
              name="name"
              rules={{ required: true }}
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="template-name" size="small" weight="plus">
                    {t("qticaret.attributeTemplates.name")}
                  </Label>
                  <Input
                    id="template-name"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event)
                      // A new template's handle follows its name until edited
                      if (!template && !form.getFieldState("handle").isDirty) {
                        form.setValue("handle", toSlug(event.target.value, 100))
                      }
                    }}
                  />
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="handle"
              rules={{ required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="template-handle" size="small" weight="plus">
                    {t("qticaret.attributeTemplates.handle")}
                  </Label>
                  <Input id="template-handle" disabled={Boolean(template)} {...field} />
                  <Text
                    size="xsmall"
                    className={fieldState.error ? "text-ui-fg-error" : "text-ui-fg-subtle"}
                  >
                    {t("qticaret.attributeTemplates.handleHint")}
                  </Text>
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="template-description" size="small" weight="plus">
                    {t("qticaret.attributeTemplates.description")}
                  </Label>
                  <Textarea id="template-description" rows={2} {...field} />
                </div>
              )}
            />
            <div className="flex flex-col gap-3">
              <Label size="small" weight="plus">
                {t("qticaret.attributeTemplates.attributes")}
              </Label>
              {definitions.fields.length === 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  {t("qticaret.attributeTemplates.noAttributes")}
                </Text>
              )}
              {definitions.fields.map((definition, index) => (
                <DefinitionFields
                  key={definition.id}
                  control={form.control}
                  getValues={form.getValues}
                  setValue={form.setValue}
                  index={index}
                  onRemove={() => {
                    definitions.remove(index)
                  }}
                />
              ))}
              <Button
                type="button"
                size="small"
                variant="secondary"
                className="w-fit"
                onClick={() => {
                  definitions.append(emptyDefinition())
                }}
              >
                {t("qticaret.attributeTemplates.addAttribute")}
              </Button>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button type="button" variant="secondary" size="small">
                {t("qticaret.common.cancel")}
              </Button>
            </Drawer.Close>
            <Button type="submit" size="small" isLoading={save.isPending}>
              {t("qticaret.common.save")}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
