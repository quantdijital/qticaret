import { useLayoutEffect, useState } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"
import { useDeleteTemplate, useSaveTemplate } from "@/features/attributes/api"
import { removedDefinitions, templateForm } from "@/features/attributes/form"
import type { TemplateForm } from "@/features/attributes/form"
import type { AttributeTemplate } from "@/features/attributes/types"
import { errorText } from "@/lib/errors"
import { isValidSlug, toSlug } from "@/lib/slug"
import { DefinitionsTab } from "./definitions-tab"
import { GroupList } from "./group-list"
import { TemplateInfo } from "./template-info"

const A = "attributes"
const TAB_BODY = "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"

type TemplateTab = "definitions" | "groups" | "info"

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
 * A template in one dialog (adr/0013), on three tabs: its attributes
 * (first: what the owner comes for), the spec table's groups, and the
 * template's own name, note and deletion. A new template opens on its
 * name, the one field it needs. Removing an attribute that products may
 * hold values for is asked about first; the arrows go to the shop's next
 * template, asking first when something is not saved.
 */
export function TemplateDialog({ template, steps, templateAt, onClose }: TemplateDialogProps) {
  const { t } = useTranslation()
  const form = useForm<TemplateForm>({ defaultValues: templateForm(template) })
  const [definitions, groups] = useWatch({
    control: form.control,
    name: ["definitions", "groups"],
  })
  const save = useSaveTemplate()
  const remove = useDeleteTemplate()
  const guard = useDiscardGuard(form.formState.isDirty)
  const [tab, setTab] = useState<TemplateTab>(template ? "definitions" : "info")
  const [pending, setPending] = useState<TemplateForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A refused field to put the caret in once its tab shows; each refusal is a new one
  const [refused, setRefused] = useState<{ id: string } | null>(null)
  useLayoutEffect(() => {
    if (refused) {
      document.getElementById(refused.id)?.focus()
    }
  }, [refused])

  const send = (values: TemplateForm, confirm: boolean) => {
    save.mutate(
      { template, form: values, confirm },
      {
        onSuccess: () => {
          toast.success(t(`${A}.saved`))
          onClose()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const submit = form.handleSubmit(
    (values) => {
      const handle = values.handle.trim() || toSlug(values.name)
      if (!values.name.trim() || (!template && !isValidSlug(handle))) {
        toast.error(t(`${A}.nameRequired`))
        setTab("info")
        setRefused({ id: "template-name" })
        return
      }
      const next = { ...values, handle }
      if (removedDefinitions(template, next).length > 0) {
        setPending(next)
      } else {
        send(next, false)
      }
    },
    // A group without a name: its tab shows the line that says so
    (errors) => {
      if (errors.groups) {
        setTab("groups")
      }
    }
  )
  const groupError = Boolean(form.formState.errors.groups)

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
        title={template ? template.name : t(`${A}.newTemplate`)}
        description={t(`${A}.templateHint`)}
        headerAction={
          template && steps ? (
            <RecordStepper
              {...steps}
              previousLabel={t(`${A}.previousTemplate`)}
              nextLabel={t(`${A}.nextTemplate`)}
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
        initialFocus={template ? null : "template-name"}
      >
        <FormProvider {...form}>
          <Tabs
            value={tab}
            onValueChange={(next) => {
              setTab(next as TemplateTab)
            }}
            className="flex min-h-0 flex-1 flex-col gap-5"
          >
            <TabsList className="w-full shrink-0 sm:w-fit">
              <TabsTrigger value="definitions">
                {t(`${A}.tabs.definitions`, { count: definitions.length })}
              </TabsTrigger>
              <TabsTrigger value="groups">
                {t(`${A}.tabs.groups`, { count: groups.length })}
                {groupError ? (
                  <span
                    className="size-1.5 rounded-full bg-destructive"
                    aria-label={t(`${A}.tabError`)}
                  />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="info">{t(`${A}.tabs.info`)}</TabsTrigger>
            </TabsList>
            {/* Started again for another template: what the parts keep for themselves too */}
            <TabsContent
              key={template?.id ?? "new"}
              value="definitions"
              forceMount
              className={TAB_BODY}
            >
              <DialogBody>
                <DefinitionsTab />
              </DialogBody>
            </TabsContent>
            <TabsContent
              key={`groups-${template?.id ?? "new"}`}
              value="groups"
              forceMount
              className={TAB_BODY}
            >
              <DialogBody>
                <GroupList />
              </DialogBody>
            </TabsContent>
            <TabsContent value="info" forceMount className={TAB_BODY}>
              <DialogBody>
                <TemplateInfo
                  saved={template !== null}
                  onDelete={() => {
                    setConfirmDelete(true)
                  }}
                />
              </DialogBody>
            </TabsContent>
          </Tabs>
        </FormProvider>
      </FormDialog>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPending(null)
          }
        }}
        title={t(`${A}.removeValuesTitle`)}
        description={t(`${A}.removeValuesDescription`, {
          names: pending
            ? removedDefinitions(template, pending)
                .map((item) => item.label)
                .join(", ")
            : "",
        })}
        confirmLabel={t(`${A}.removeValuesConfirm`)}
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
          title={t(`${A}.deleteTitle`, { name: template.name })}
          description={t(`${A}.deleteDescription`)}
          confirmLabel={t(`${A}.deleteTemplate`)}
          destructive
          onConfirm={() => {
            remove.mutate(template.id, {
              onSuccess: () => {
                toast.success(t(`${A}.deleted`))
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
