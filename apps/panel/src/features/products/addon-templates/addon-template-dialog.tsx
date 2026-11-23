import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  useDeleteAddonTemplate,
  useSaveAddonTemplate,
} from "@/features/products/api/addon-templates"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import { ADDON_LIMITS } from "@/features/products/api/addons"
import { addonsFailureOf } from "@/features/products/detail/addon-failure"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { AddonDialog } from "@/features/products/detail/addon-dialog"
import { AddonNotice } from "@/features/products/detail/addon-notice"
import { AddonRow } from "@/features/products/detail/addon-row"
import { inputOf, valueOf } from "@/features/products/detail/addon-values"
import type { AddonValue } from "@/features/products/detail/addon-values"
import { errorText } from "@/lib/errors"

const T = "products.addonTemplates"

/** Template refusals said in this dialog's words; others as the add-ons card says them. */
const TEMPLATE_REFUSALS: Readonly<Record<string, string>> = {
  "addon_templates.name_invalid": "name",
  "addon_templates.empty": "empty",
  "addon_templates.too_many": "tooMany",
}

function failureOf(t: ReturnType<typeof useTranslation>["t"], error: unknown, flagOn: boolean) {
  const { message } = (error ?? {}) as { message?: unknown }
  const key = typeof message === "string" ? TEMPLATE_REFUSALS[message] : undefined
  return key
    ? { text: t(`${T}.errors.${key}`), features: false }
    : addonsFailureOf(t, error, flagOn)
}

/** Which add-on the inner dialog edits: an index in the list, or null for a new one. */
type Editing = { index: number | null } | null

interface AddonTemplateDialogProps {
  /** The template to edit; null for a new one. */
  template: AddonTemplate | null
  /** Whether the shop's add-ons are on; off, the template is shown, not changed. */
  flagOn: boolean
  onClose: () => void
}

/**
 * One add-on template in the standard dialog (adr/0052 Ek 2026-11-23):
 * its name and its add-ons, each opened in the add-on dialog the product
 * page uses. Saving changes every product it is linked to, which it says;
 * a saved one can be deleted here, its products losing its add-ons.
 */
export function AddonTemplateDialog({ template, flagOn, onClose }: AddonTemplateDialogProps) {
  const { t } = useTranslation()
  const save = useSaveAddonTemplate()
  const remove = useDeleteAddonTemplate()
  const [name, setName] = useState(template?.name ?? "")
  const [items, setItems] = useState<AddonValue[]>(() => (template?.addons ?? []).map(valueOf))
  const [editing, setEditing] = useState<Editing>(null)
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty =
    name !== (template?.name ?? "") ||
    JSON.stringify(items) !== JSON.stringify((template?.addons ?? []).map(valueOf))
  const guard = useDiscardGuard(dirty)
  const used = (template?.product_count ?? 0) + (template?.attribute_templates.length ?? 0) > 0

  const submit = () => {
    if (!name.trim()) {
      setFailure({ text: t(`${T}.errors.name`), features: false })
      return
    }
    if (items.length === 0) {
      setFailure({ text: t(`${T}.errors.empty`), features: false })
      return
    }
    save.mutate(
      { id: template?.id ?? null, name: name.trim(), addons: items.map(inputOf) },
      {
        onSuccess: () => {
          toast.success(t(`${T}.saved`))
          onClose()
        },
        onError: (error) => {
          setFailure(failureOf(t, error, flagOn))
        },
      }
    )
  }

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
        title={template ? template.name : t(`${T}.new`)}
        description={t(`${T}.dialogHint`)}
        dirty={dirty}
        saving={save.isPending}
        onSubmit={submit}
        guard={guard}
        initialFocus={template ? null : "addon-template-name"}
      >
        <DialogBody>
          {flagOn ? null : (
            <AddonNotice tone="warning" text={t("products.addons.flagOff")} features />
          )}
          <Field
            label={t(`${T}.name`)}
            htmlFor="addon-template-name"
            hint={t(`${T}.nameHint`, { max: ADDON_LIMITS.label })}
            required
          >
            <Input
              id="addon-template-name"
              value={name}
              maxLength={ADDON_LIMITS.label}
              disabled={!flagOn}
              onChange={(event) => {
                setName(event.target.value)
              }}
            />
          </Field>
          <Field label={t(`${T}.addons`)} hint={t(`${T}.addonsHint`, { max: ADDON_LIMITS.addons })}>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
                {t(`${T}.noAddons`)}
              </p>
            ) : (
              <ol className="flex flex-col divide-y rounded-md border">
                {items.map((item, index) => (
                  <AddonRow
                    key={item.id ?? `new-${String(index)}`}
                    value={item}
                    index={index}
                    count={items.length}
                    readOnly={!flagOn}
                    onMove={(to) => {
                      const next = [...items]
                      const [moved] = next.splice(index, 1)
                      if (moved) {
                        next.splice(to, 0, moved)
                      }
                      setItems(next)
                    }}
                    onEdit={() => {
                      setEditing({ index })
                    }}
                    onRemove={() => {
                      setItems(items.filter((_, at) => at !== index))
                    }}
                  />
                ))}
              </ol>
            )}
          </Field>
          {flagOn ? (
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={items.length >= ADDON_LIMITS.addons}
                onClick={() => {
                  setEditing({ index: null })
                }}
              >
                <Plus />
                {t("products.addons.add")}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {template && used
              ? t(`${T}.liveNote`, {
                  count: template.product_count,
                  templates:
                    template.attribute_templates.map((each) => each.name).join(", ") || "—",
                })
              : t(`${T}.liveNoteNew`)}
          </p>
          {failure ? <AddonNotice tone="danger" {...failure} /> : null}
          {template ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <p className="text-[13px] text-muted-foreground">{t(`${T}.deleteHint`)}</p>
              <Button
                type="button"
                variant="outline"
                className="text-destructive-text"
                onClick={() => {
                  setConfirmDelete(true)
                }}
              >
                <Trash2 />
                {t(`${T}.delete`)}
              </Button>
            </div>
          ) : null}
        </DialogBody>
      </FormDialog>
      {/* Beside the template's dialog: a submit in it would bubble to the template's form */}
      {editing ? (
        <AddonDialog
          items={items}
          index={editing.index}
          onGo={(index) => {
            setEditing({ index })
          }}
          saving={false}
          failure={null}
          note={t(`${T}.addonNote`)}
          onClose={() => {
            setEditing(null)
          }}
          onSave={(value) => {
            setItems(
              editing.index === null
                ? [...items, value]
                : items.map((item, index) => (index === editing.index ? value : item))
            )
            setEditing(null)
          }}
        />
      ) : null}
      {template ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t(`${T}.deleteTitle`, { name: template.name })}
          description={t(`${T}.deleteDescription`, { count: template.product_count })}
          confirmLabel={t(`${T}.delete`)}
          destructive
          onConfirm={() => {
            remove.mutate(template.id, {
              onSuccess: () => {
                toast.success(t(`${T}.deleted`))
                onClose()
              },
              onError: (error) => toast.error(errorText(t, error)),
            })
          }}
        />
      ) : null}
    </>
  )
}
