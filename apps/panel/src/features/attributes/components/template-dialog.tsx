import { Trash2 } from "lucide-react"
import { useLayoutEffect, useState } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FieldHints } from "@qticaret/admin-ui/hooks/use-field-hints"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"
import { useDeleteTemplate, useSaveTemplate } from "@/features/attributes/api"
import { removedDefinitions, templateForm } from "@/features/attributes/form"
import type { TemplateForm } from "@/features/attributes/form"
import type { AttributeTemplate } from "@/features/attributes/types"
import { errorText } from "@/lib/errors"
import { isValidSlug, toSlug } from "@/lib/slug"
import { AddonTemplatesTab } from "./addon-templates-tab"
import { DefinitionsTab } from "./definitions-tab"
import { GroupList } from "./group-list"
import { TemplateInfo } from "./template-info"

const A = "attributes"
const TAB_BODY = "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"

type TemplateTab = "definitions" | "groups" | "addons"

interface TemplateDialogProps {
  /** The group to edit; null for a new one. */
  template: AttributeTemplate | null
  /** A saved group's place among the shop's: ‹ n / m › walks them. */
  steps?: RecordSteps
  /** The group the arrows go to, by its place: the form starts again from it. */
  templateAt?: (index: number) => AttributeTemplate | undefined
  onClose: () => void
  /** The shop's add-ons are on (adr/0052 Ek 2026-11-23): the add-ons tab shows. */
  addonsOn?: boolean
}

/**
 * An attribute group (adr/0013 template) in one dialog: its name on top,
 * then its attributes (what the owner comes for), the product page's
 * sections and the add-on groups its products get (adr/0052 Ek
 * 2026-11-23) on tabs. Deleting sits in the footer. Help texts fold into
 * an (i) beside their field. Removing an attribute products may hold
 * values for is asked about first; the arrows go to the shop's next
 * group, asking first when something is not saved.
 */
export function TemplateDialog({
  template,
  steps,
  templateAt,
  onClose,
  addonsOn = false,
}: TemplateDialogProps) {
  const { t } = useTranslation()
  const form = useForm<TemplateForm>({ defaultValues: templateForm(template) })
  const [definitions, groups, carried] = useWatch({
    control: form.control,
    name: ["definitions", "groups", "addonTemplateIds"],
  })
  // adr/0052 Ek 2026-11-23: shown while the shop's add-ons are on, or while it carries some
  const showAddons = addonsOn || (template?.addon_template_ids?.length ?? 0) > 0
  const save = useSaveTemplate()
  const remove = useDeleteTemplate()
  const guard = useDiscardGuard(form.formState.isDirty)
  const [tab, setTab] = useState<TemplateTab>("definitions")
  const [more, setMore] = useState(false)
  const [pending, setPending] = useState<TemplateForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A refused field to put the caret in once it shows; each refusal is a new one
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
        // A name that makes no short name: the short name is what to fix
        const badHandle = values.name.trim() !== "" && values.handle.trim() !== ""
        if (badHandle) {
          setMore(true)
        }
        setRefused({ id: badHandle ? "template-handle" : "template-name" })
        return
      }
      const next = { ...values, handle }
      if (removedDefinitions(template, next).length > 0) {
        setPending(next)
      } else {
        send(next, false)
      }
    },
    // A section without a name: its tab shows the line that says so
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
        footerStart={
          template ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive-text"
              disabled={save.isPending}
              onClick={() => {
                setConfirmDelete(true)
              }}
            >
              <Trash2 />
              {t(`${A}.deleteTemplate`)}
            </Button>
          ) : null
        }
      >
        <FormProvider {...form}>
          <FieldHints style="tip">
            <div className="shrink-0">
              <TemplateInfo
                key={template?.id ?? "new"}
                saved={template !== null}
                more={more}
                onMoreChange={setMore}
              />
            </div>
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
                {showAddons ? (
                  <TabsTrigger value="addons">
                    {t(`${A}.tabs.addons`, { count: carried.length })}
                  </TabsTrigger>
                ) : null}
              </TabsList>
              {/* Started again for another group: what the parts keep for themselves too */}
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
              {showAddons ? (
                <TabsContent value="addons" forceMount className={TAB_BODY}>
                  <DialogBody>
                    <AddonTemplatesTab />
                  </DialogBody>
                </TabsContent>
              ) : null}
            </Tabs>
          </FieldHints>
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
